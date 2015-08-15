import inflection from 'inflection'
import { reservedKeys, inBrackets, mediaType,
  isField, isMatch } from './settings'


const queryDelimiter = '?'


export function initializeContext (context, request) {
  const {
    uriTemplate, methodMap, inputMethods,
    options, recordTypes, adapter, keys,
    errors: { UnsupportedError, NotFoundError }
  } = this

  const { serializerInput, serializerOutput, payload } = context.request

  const method = context.request.method = methodMap[request.method]

  // Not according to the spec but probably a good idea in practice, do not
  // allow a different media type for input.
  if (serializerInput !== serializerOutput && inputMethods.has(method))
    throw new UnsupportedError(
      `The media type of the input must be "${mediaType}".`)

  const { obfuscateURIs, inflectPath } = options

  let { url } = request

  // Unobfuscate URIs.
  if (obfuscateURIs) {
    // The query string should not be obfuscated.
    const route = url.slice(1).split(queryDelimiter)
    const query = queryDelimiter + route.slice(1).join(queryDelimiter)

    url = '/' + new Buffer((route[0] + Array(5 - route[0].length % 4)
      .join('=')).replace(/\-/g, '+').replace(/_/g, '/'), 'base64')
      .toString() + query
  }

  // Decode URI Component only for the query string.
  const uriObject = uriTemplate.fromUri(
    url.split(queryDelimiter).map((part, index) =>
      index > 0 ? decodeURIComponent(part) : part).join(queryDelimiter))

  if (!Object.keys(uriObject).length && url.length > 1)
    throw new NotFoundError(`Invalid URI.`)

  context.request.uriObject = uriObject

  context.request.type = uriObject.type ? inflectPath ?
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

  const { relatedField } = uriObject

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
    context.request.originalType = type
    context.request.originalIds = ids

    // Write the related info to the request, which should take
    // precedence over the original type and IDs.
    context.request.type = relatedType
    context.request.ids = relatedIds

    return context
  }) : context
}


function attachQueries (context) {
  const { recordTypes, keys, options, castValue,
    options: { includeLimit, maxLimit, queries } } = this
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
    if (parameter.match(isMatch)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = castValue(query[parameter],
        fields[field][keys.type], options)
    }
  }

  // Attach sort option.
  if (queries.has('sort') && query.sort) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [ sort ]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      if (firstChar === '-') sort[field.slice(1)] = false
      else sort[field] = true

      return sort
    }, {})
  }

  // Attach include option.
  if (queries.has('include') && query.include)
    request.include = (Array.isArray(query.include) ?
      query.include : [ query.include ])
      .map(i => i.split('.').slice(0, includeLimit))

  // Attach offset option.
  if (queries.has('offset') && query.offset)
    request.options.offset = Math.abs(parseInt(query.offset, 10))

  // Attach limit option.
  if (queries.has('limit') && query.limit)
    request.options.limit = Math.abs(parseInt(query.limit, 10))

  // Check limit option.
  const { options: { limit } } = request
  if (!limit || limit > maxLimit) request.options.limit = maxLimit
}


export function showLinks (type) {
  const { options, uriTemplate, keys, recordTypes } = this
  const fields = recordTypes[type]
  const { prefix, inflectPath, obfuscateURIs } = options
  const output = {
    [reservedKeys.id]: prefix + encodeRoute(uriTemplate.fillFromObject({
      type: inflectPath ? inflection.pluralize(type) : type
    }), obfuscateURIs)
  }

  for (let field in fields) {
    const fieldDefinition = fields[field]

    if (!fieldDefinition[keys.link]) continue

    output[field] = {
      [reservedKeys.type]: fieldDefinition[keys.link],
      [reservedKeys.array]: Boolean(fieldDefinition[keys.isArray])
    }

    const link = fieldDefinition[keys.link]
    const inverse = fieldDefinition[keys.inverse]

    // Show inverse on link fields that do not have a denormalized inverse.
    if (inverse && !recordTypes[link][inverse][keys.denormalizedInverse])
      output[field][reservedKeys.inverse] = inverse
  }

  return output
}


export function mapRecord (type, record) {
  const { keys, options, recordTypes, uriTemplate } = this
  const fields = recordTypes[type]
  const { prefix, inflectPath, obfuscateURIs } = options
  const clone = {}

  const id = record[keys.primary]

  clone[reservedKeys.type] = type
  clone[reservedKeys.id] = prefix +
    encodeRoute(uriTemplate.fillFromObject({
      type: inflectPath ? inflection.pluralize(type) : type,
      ids: id
    }), obfuscateURIs)
  clone[reservedKeys.meta] = {}
  clone[keys.primary] = id

  for (let field in record) {
    const fieldDefinition = fields[field]

    // Handle undefined fields.
    if (!fieldDefinition) {
      if (field !== keys.primary)
        clone[reservedKeys.meta][field] = record[field]
      continue
    }

    // Rearrange order of typed fields.
    if (fieldDefinition[keys.type]) {
      clone[field] = record[field]
      continue
    }

    // Handle link fields.
    const ids = record[field]

    clone[field] = {
      [reservedKeys.id]: prefix +
        encodeRoute(uriTemplate.fillFromObject({
          type: inflectPath ? inflection.pluralize(type) : type,
          ids: id, relatedField: field
        }), obfuscateURIs),
      [keys.primary]: ids
    }
  }

  if (!Object.keys(clone[reservedKeys.meta]).length)
    delete clone[reservedKeys.meta]

  return clone
}


export function showQueries (queries, request) {
  const query = {}

  if (queries.has('include'))
    query.include = request.include ?
      request.include.map(path => path.join('.')) : []

  if (queries.has('offset'))
    query.offset = request.options.offset || 0

  if (queries.has('limit'))
    query.limit = request.options.limit || 0

  if (queries.has('match'))
    query.match = request.options.match || {}

  if (queries.has('field'))
    query.field = request.options.field || {}

  if (queries.has('sort'))
    query.sort = request.options.sort || {}

  return query
}


export function attachIncluded (record) {
  if (!record[reservedKeys.meta]) record[reservedKeys.meta] = {}
  record[reservedKeys.meta].included = true

  return record
}


/**
 * Encode a route in Base64 encoding or URI encoding.
 *
 * @param {String} route
 * @param {Boolean} encode
 */
export function encodeRoute (route, encode) {
  return encode ? '/' + new Buffer(route.slice(1)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : route
}
