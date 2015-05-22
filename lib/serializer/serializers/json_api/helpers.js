import inflection from 'inflection'
import {
  reservedKeys, defaults,
  inBrackets, isField, isFilter, pageOffset
} from './settings'

/**
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
export function mapRecord (type, record) {
  const { keys, options, uriTemplate, schemas } = this
  const prefix = 'prefix' in options ? options.prefix : defaults.prefix
  const id = record[keys.primary]
  delete record[keys.primary]

  const fields = new Set(Object.keys(record))

  record[reservedKeys.type] = type
  record[reservedKeys.id] = id.toString()
  record[reservedKeys.meta] = {}
  record[reservedKeys.attributes] = {}
  record[reservedKeys.relationships] = {}
  record[reservedKeys.links] = {
    [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
      type: options.inflectType ? inflection.pluralize(type) : type,
      ids: id
    })
  }

  fields.forEach(field => {
    const schemaField = schemas[type][field]

    // Per the recommendation, dasherize keys.
    if (options.inflectKeys) {
      const value = record[field]
      delete record[field]
      field = inflection.transform(field,
        [ 'underscore', 'dasherize' ])
      record[field] = value
    }

    // Handle meta/attributes.
    if (!schemaField || keys.type in schemaField) {
      const value = record[field]
      delete record[field]

      if (!schemaField) record[reservedKeys.meta][field] = value
      else record[reservedKeys.attributes][field] = value

      return
    }

    // Handle link fields.
    let ids = record[field]
    delete record[field]

    if (!schemaField[keys.isArray] && Array.isArray(ids))
      ids = ids[0]

    if (schemaField[keys.isArray] && !Array.isArray(ids))
      ids = [ids]

    const linkType = schemaField[keys.link]

    record[reservedKeys.relationships][field] = {
      [reservedKeys.links]: {
        [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
          type: options.inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: reservedKeys.relationships,
          relationship: field
        }),
        [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
          type: options.inflectType ? inflection.pluralize(type) : type,
          ids: id,
          relatedField: field
        })
      },
      [reservedKeys.primary]: schemaField[keys.isArray] ?
        ids.map(toIdentifier.bind(null, linkType)) :
        (ids ? {
          [reservedKeys.type]: linkType,
          [reservedKeys.id]: ids.toString()
        } : null)
    }
  })

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
  if (!type)
    return value

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), options.bufferEncoding)

  return value
}


export function attachQueries (context, query, options) {
  const { request } = context
  const { includeDepth, pageLimit } = options

  // Iterate over dynamic query strings.
  Object.keys(query).forEach(parameter => {

    // Attach fields option.
    if (parameter.match(isField)) {
      const sparseField = query[parameter]
      const sparseType = (parameter.match(inBrackets) || [])[1]
      const fields = (Array.isArray(sparseField) ?
        sparseField : [sparseField]).reduce((fields, field) => {
          fields[field] = true
          return fields
        }, {})

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

  })

  // Attach include option.
  if (reservedKeys.include in query)
    request.include = query[reservedKeys.include]
      .split(',').map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach sort option.
  if (reservedKeys.sort in query) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [sort]

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


export function processData (request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('error', reject)
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
