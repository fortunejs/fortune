import inflection from 'inflection'
import deepEqual from 'deep-equal'
import { reservedKeys, inBrackets, isField, isFilter,
  mediaType, pageOffset, pageLimit } from './settings'


export function initializeContext (context, request) {
  const {
    uriTemplate, methodMap, inputMethods, recordTypes,
    adapter, keys, methods, options: { inflectType, inflectKeys },
    errors: { UnsupportedError, NotFoundError }
  } = this

  const { serializerInput, serializerOutput, payload } = context.request

  const method = context.request.method = methodMap[request.method]

  // Not according to the spec but probably a good idea in practice, do not
  // allow a different media type for input.
  if (serializerInput !== serializerOutput && inputMethods.has(method))
    throw new UnsupportedError(
      `The media type of the input must be "${mediaType}".`)

  // Decode URI Component only for the query string.
  const uriObject = uriTemplate.fromUri(
    request.url.split('?').map((part, index) =>
      index > 0 ? decodeURIComponent(part) : part).join('?'))

  if (!Object.keys(uriObject).length && request.url.length > 1)
    throw new NotFoundError(`Invalid URI.`)

  context.request.uriObject = uriObject

  context.request.type = uriObject.type ? inflectType ?
    inflection.singularize(uriObject.type) : uriObject.type : null

  context.request.ids = uriObject.ids ?
    (Array.isArray(uriObject.ids) ?
    uriObject.ids : [ uriObject.ids ])
    .map(id => {
      // Stolen from jQuery source code:
      // https://api.jquery.com/jQuery.isNumeric/
      const float = Number.parseFloat(id)
      return id - float + 1 >= 0 ? float : id
    }) : null

  const { type, ids } = context.request
  const fields = recordTypes[type]

  attachQueries.call(this, context)

  if (Buffer.isBuffer(payload))
    context.request.payload = JSON.parse(payload.toString())

  let { relatedField, relationship } = uriObject

  if (relationship) {
    if (relatedField !== reservedKeys.relationships)
      throw new NotFoundError(`Invalid relationship URI.`)

    // This is a little unorthodox, but POST and DELETE requests to a
    // relationship entity should be treated as updates.
    if (method === methods.create || method === methods.delete) {
      context.request.originalMethod = method
      context.request.method = methods.update
    }

    relatedField = relationship
  }

  if (relatedField && inflectKeys)
    relatedField = inflection.camelize(under(relatedField), true)

  if (relatedField && (!(relatedField in fields) ||
    !(keys.link in fields[relatedField]) ||
    fields[relatedField][keys.denormalizedInverse]))
    throw new NotFoundError(`The field "${relatedField}" is ` +
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

    const relatedType = fields[relatedField][keys.link]

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
 * Internal function to map a record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
export function mapRecord (type, record) {
  const { keys, options, uriTemplate, recordTypes } = this
  const fields = recordTypes[type]
  const { prefix, inflectType, inflectKeys } = options
  const clone = {}

  const id = record[keys.primary]

  clone[reservedKeys.type] = inflectType ? inflection.pluralize(type) : type
  clone[reservedKeys.id] = id.toString()
  clone[reservedKeys.meta] = {}
  clone[reservedKeys.attributes] = {}
  clone[reservedKeys.relationships] = {}
  clone[reservedKeys.links] = {
    [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
      type: inflectType ? inflection.pluralize(type) : type,
      ids: id
    })
  }

  for (let field in record) {
    if (field === keys.primary) continue

    const fieldDefinition = fields[field]
    const originalField = field

    // Per the recommendation, dasherize keys.
    if (inflectKeys)
      field = inflection.transform(field,
        [ 'underscore', 'dasherize' ])

    // Handle meta/attributes.
    if (!fieldDefinition || fieldDefinition[keys.type]) {
      const value = record[originalField]

      if (!fieldDefinition) clone[reservedKeys.meta][field] = value
      else clone[reservedKeys.attributes][field] = value

      continue
    }

    // Handle link fields.
    const ids = record[originalField]

    const linkedType = inflectType ?
      inflection.pluralize(fieldDefinition[keys.link]) :
      fieldDefinition[keys.link]

    clone[reservedKeys.relationships][field] = {
      [reservedKeys.links]: {
        [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: reservedKeys.relationships,
          relationship: inflectKeys ? inflection.transform(field,
            [ 'underscore', 'dasherize' ]) : field
        }),
        [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: inflectKeys ? inflection.transform(field,
            [ 'underscore', 'dasherize' ]) : field
        })
      },
      [reservedKeys.primary]: fieldDefinition[keys.isArray] ?
        ids.map(toIdentifier.bind(null, linkedType)) :
        (ids ? toIdentifier(linkedType, ids) : null)
    }
  }

  if (!Object.keys(clone[reservedKeys.attributes]).length)
    delete clone[reservedKeys.attributes]

  if (!Object.keys(clone[reservedKeys.meta]).length)
    delete clone[reservedKeys.meta]

  if (!Object.keys(clone[reservedKeys.relationships]).length)
    delete clone[reservedKeys.relationships]

  return clone
}


function toIdentifier (type, id) {
  return {
    [reservedKeys.type]: type,
    [reservedKeys.id]: id.toString()
  }
}


function attachQueries (context) {
  const { recordTypes, keys, options, castValue,
    options: { includeLimit, maxLimit } } = this
  const { request, request: { type } } = context
  const fields = recordTypes[type]
  const reduceFields = (fields, field) => {
    fields[field] = true
    return fields
  }

  let { request: { uriObject: { query } } } = context
  if (!query) query = {}

  // Iterate over dynamic query strings.
  for (let parameter of Object.keys(query)) {
    // Attach fields option.
    if (parameter.match(isField)) {
      const sparseField = query[parameter]
      const sparseType = (parameter.match(inBrackets) || [])[1]
      const fields = (Array.isArray(sparseField) ?
        sparseField : [ sparseField ]).reduce(reduceFields, {})

      if (sparseType === type)
        request.options.fields = fields
      else if (sparseType) {
        if (!(sparseType in request.includeOptions))
          request.includeOptions[sparseType] = {}

        request.includeOptions[sparseType].fields = fields
      }
    }

    // Attach match option.
    if (parameter.match(isFilter)) {
      if (!('match' in request.options)) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = castValue(query[parameter],
        fields[field][keys.type], options)
    }
  }

  // Attach include option.
  if (reservedKeys.include in query) {
    request.include = (Array.isArray(query[reservedKeys.include]) ?
      query[reservedKeys.include] : [ query[reservedKeys.include] ])
      .map(i => i.split('.').slice(0, includeLimit))

    // Manually expand nested includes.
    for (let path of request.include) {
      for (let i = path.length - 1; i > 0; i--) {
        const j = path.slice(0, i)
        if (!request.include.some(deepEqual.bind(null, j)))
          request.include.push(j)
      }
    }
  }

  // Attach sort option.
  if (reservedKeys.sort in query) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [ sort ]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      if (firstChar === '-') sort[field.slice(1)] = false
      else sort[field] = true

      return sort
    }, {})
  }

  // Attach offset option.
  if (pageOffset in query)
    request.options.offset = Math.abs(parseInt(query[pageOffset], 10))

  // Attach limit option.
  if (pageLimit in query)
    request.options.limit = Math.abs(parseInt(query[pageLimit], 10))

  // Check limit option.
  const { options: { limit } } = request
  if (!limit || limit > maxLimit) request.options.limit = maxLimit
}


export function mapId (relatedType, link) {
  const { errors: { ConflictError } } = this

  if (link[reservedKeys.type] !== relatedType)
    throw new ConflictError(`Data object field ` +
      `"${reservedKeys.type}" is invalid, it must be ` +
      `"${relatedType}", not "${link[reservedKeys.type]}".`)

  return link[reservedKeys.id]
}


export function matchId (object, id) {
  return id === object[reservedKeys.id]
}


export function under (s) {
  return s.replace(/-/g, '_')
}
