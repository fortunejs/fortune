import inflection from 'inflection'
import { reservedKeys, inBrackets, isField, isFilter,
  pageOffset } from './settings'


export function initializeContext (context, request, payload) {
  const {
    uriTemplate, methodMap,
    options, schemas, adapter, keys, errors, methods
  } = this
  const { inflectType } = options

  const uriObject = uriTemplate.fromUri(request.url)

  context.request.method = methodMap[request.method]

  context.request.type = inflectType && uriObject.type ?
    inflection.singularize(uriObject.type) : uriObject.type

  context.request.ids = uriObject.ids ?
    (Array.isArray(uriObject.ids) ?
    uriObject.ids : [ uriObject.ids ])
    .map(id => {
      // Stolen from jQuery source code:
      // https://api.jquery.com/jQuery.isNumeric/
      const float = Number.parseFloat(id)
      return id - float + 1 >= 0 ? float : id
    }) : null

  const { method, type, ids } = context.request
  const schema = schemas[type]

  attachQueries(context, uriObject.query || {}, options)

  if (payload.length)
    context.request.payload = JSON.parse(payload.toString())

  let { relatedField, relationship } = uriObject

  if (relationship) {
    if (relatedField !== reservedKeys.relationships)
      throw new errors.NotFoundError(`Invalid relationship URL.`)

    // This is a little unorthodox, but POST and DELETE requests to a
    // relationship entity should be treated as updates.
    if (method === methods.create || method === methods.delete) {
      context.request.originalMethod = method
      context.request.method = methods.update
    }

    relatedField = relationship
  }

  if (relatedField && (!(relatedField in schema) ||
    !(keys.link in schema[relatedField]) ||
    keys.denormalizedInverse in schema[relatedField]))
    throw new errors.NotFoundError(`The field "${relatedField}" is ` +
      `not a link on the type "${type}".`)

  return relatedField ? adapter.find(type, ids, {
    // We only care about getting the related field.
    fields: { [relatedField]: true }
  })

  .then(records => {
    // Reduce the related IDs from all of the records into an array of
    // unique IDs.
    const relatedIds = [ ...(records || []).reduce((ids, record) => {
      const value = record[relatedField]

      if (Array.isArray(value)) for (let id of value) ids.add(id)
      else ids.add(value)

      return ids
    }, new Set()) ]

    const relatedType = schema[relatedField][keys.link]

    // Copy the original type and IDs to temporary keys.
    context.request.relatedField = relatedField
    context.request.relationship = Boolean(relationship)
    context.request.originalType = type
    context.request.originalIds = ids

    // Write the related info to the request, which should take
    // precedence over the original type and IDs.
    context.request.type = relatedType
    context.request.ids = relatedIds

    return context
  }) : context
}


/**
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
export function mapRecord (type, record) {
  const { keys, options, uriTemplate, schemas } = this
  const schema = schemas[type]
  const { prefix, inflectType, inflectKeys } = options

  const id = record[keys.primary]
  delete record[keys.primary]

  const fields = Object.keys(record)

  record[reservedKeys.type] = type
  record[reservedKeys.id] = id.toString()
  record[reservedKeys.meta] = {}
  record[reservedKeys.attributes] = {}
  record[reservedKeys.relationships] = {}
  record[reservedKeys.links] = {
    [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
      type: inflectType ? inflection.pluralize(type) : type,
      ids: id
    })
  }

  for (let field of fields) {
    const fieldDefinition = schema[field]

    // Do not show denormalized inverse fields.
    if (fieldDefinition && fieldDefinition[keys.denormalizedInverse]) {
      delete record[field]
      continue
    }

    // Per the recommendation, dasherize keys.
    if (inflectKeys) {
      const value = record[field]
      delete record[field]
      field = inflection.transform(field,
        [ 'underscore', 'dasherize' ])
      record[field] = value
    }

    // Handle meta/attributes.
    if (!fieldDefinition || fieldDefinition[keys.type]) {
      const value = record[field]
      delete record[field]

      if (!fieldDefinition) record[reservedKeys.meta][field] = value
      else record[reservedKeys.attributes][field] = value

      continue
    }

    // Handle link fields.
    const ids = record[field]
    delete record[field]

    const linkedType = fieldDefinition[keys.link]

    record[reservedKeys.relationships][field] = {
      [reservedKeys.links]: {
        [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: reservedKeys.relationships,
          relationship: field
        }),
        [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: field
        })
      },
      [reservedKeys.primary]: fieldDefinition[keys.isArray] ?
        ids.map(toIdentifier.bind(null, linkedType)) :
        (ids ? toIdentifier(linkedType, ids) : null)
    }
  }

  if (!Object.keys(record[reservedKeys.attributes]).length)
    delete record[reservedKeys.attributes]

  if (!Object.keys(record[reservedKeys.meta]).length)
    delete record[reservedKeys.meta]

  if (!Object.keys(record[reservedKeys.relationships]).length)
    delete record[reservedKeys.relationships]

  return record
}


function toIdentifier (type, id) {
  return { [reservedKeys.type]: type, [reservedKeys.id]: id.toString() }
}


export function castValue (value, type, options) {
  const { bufferEncoding } = options

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), bufferEncoding)

  return value
}


function attachQueries (context, query, options) {
  const { request } = context
  const { includeDepth, pageLimit } = options
  const reduceFields = (fields, field) => {
    fields[field] = true
    return fields
  }

  // Iterate over dynamic query strings.
  for (let parameter of Object.keys(query)) {
    // Attach fields option.
    if (parameter.match(isField)) {
      const sparseField = query[parameter]
      const sparseType = (parameter.match(inBrackets) || [])[1]
      const fields = (Array.isArray(sparseField) ?
        sparseField : [ sparseField ]).reduce(reduceFields, {})

      if (sparseType === request.type)
        request.options.fields = fields
      else if (sparseType) {
        if (!(sparseType in request.includeOptions))
          request.includeOptions[sparseType] = {}

        request.includeOptions[sparseType].fields = fields
      }
    }

    // Attach match option.
    if (parameter.match(isFilter)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = query[parameter]
    }
  }

  // Attach include option.
  if (reservedKeys.include in query)
    request.include = (Array.isArray(query[reservedKeys.include]) ?
      query[reservedKeys.include] : [ query[reservedKeys.include] ])
      .map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach sort option.
  if (reservedKeys.sort in query) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [ sort ]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      sort[field.slice(1)] = firstChar === '+' ? 1 : -1

      return sort
    }, {})
  }

  // Attach offset option.
  if (pageOffset in query)
    request.options.offset =
      Math.abs(parseInt(query[pageOffset], 10))

  // Attach default limit.
  if (pageLimit in query) {
    const limit = Math.abs(parseInt(query[pageLimit], 10))
    request.options.limit =
      limit > pageLimit ? pageLimit : limit
  }
  else request.options.limit = pageLimit
}


export function stringifyObject (payload, options) {
  const { bufferEncoding, spaces } = options

  return JSON.stringify(payload, (key, value) => {
    if (value && value.type === 'Buffer' && Array.isArray(value.data))
      return new Buffer(value.data).toString(bufferEncoding)

    return value
  }, spaces)
}


export function mapId (relatedType, link) {
  const { errors } = this

  if (link[reservedKeys.type] !== relatedType)
    throw new errors.ConflictError(`Data object field ` +
      `"$(reservedKeys.type)" is invalid, it must be ` +
      `"$(relatedType)".`)

  return link[reservedKeys.id]
}


export function processData (request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('error', reject)
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
