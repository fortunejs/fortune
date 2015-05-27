import inflection from 'inflection'
import { inBrackets, isField, isMatch } from './settings'


export function processData (request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('error', reject)
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}


export function initializeContext (context, request, payload) {
  const {
    uriTemplate, methodMap,
    options, schemas, adapter, keys, errors
  } = this

  const uriObject = uriTemplate.fromUri(request.url)

  context.request.method = methodMap[request.method]

  context.request.type = options.inflectType && uriObject.type ?
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

  const { type, ids } = context.request
  const schema = schemas[type]

  attachQueries(context, uriObject.query || {}, options)

  if (payload.length)
    context.request.payload = JSON.parse(payload.toString())

  const { relatedField } = uriObject

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
    context.request.originalType = type
    context.request.originalIds = ids

    // Write the related info to the request, which should take
    // precedence over the original type and IDs.
    context.request.type = relatedType
    context.request.ids = relatedIds

    return context
  }) : context
}


export function stringifyObject (object, options) {
  return JSON.stringify(object, (key, value) => {
    if (value && value.type === 'Buffer' && Array.isArray(value.data))
      return new Buffer(value.data).toString(options.bufferEncoding)

    return value
  }, options.spaces)
}


function attachQueries (context, query, options) {
  const { request } = context
  const { queries, includeDepth, pageLimit } = options
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
    if (parameter.match(isMatch)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = query[parameter]
    }
  }

  // Attach sort option.
  if (queries.has('sort') && query.sort) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [ sort ]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      sort[field.slice(1)] = firstChar === '+' ? 1 : -1

      return sort
    }, {})
  }

  // Attach include option.
  if (queries.has('include') && query.include)
    request.include = (Array.isArray(query.include) ?
      query.include : [ query.include ])
      .map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach offset option.
  if (queries.has('offset') && query.offset)
    request.options.offset =
      Math.abs(parseInt(query.offset, 10))

  // Attach default limit.
  if (queries.has('limit') && query.limit) {
    const limit = Math.abs(parseInt(query.limit, 10))
    request.options.limit =
      limit > pageLimit ? pageLimit : limit
  }
  else request.options.limit = pageLimit
}
