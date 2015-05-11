import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import * as arrayProxy from '../../../common/array_proxy'


// JSON API is an extremely verbose specification that contains many
// redundancies to cover everyone's use cases, such as linkage objects and
// relationship entities (entirely unnecessary), and fails to cover many
// edge cases. More importantly, it assumes tight coupling with the API
// consumer and the HTTP protocol, and it is not really a hypermedia format.
//
// The format is painful to implement and the specification is pretty long,
// so don't do it unless you're a masochist like me.


const mediaType = 'application/vnd.api+json'

// Reserved keys from the JSON API specification.
const reservedKeys = {
  primary: 'data',
  links: 'links',
  linkage: 'linkage',
  self: 'self',
  type: 'type',
  id: 'id',
  errors: 'errors',
  included: 'included',
  attributes: 'attributes',
  meta: 'meta',
  first: 'first',
  last: 'last',
  prev: 'prev',
  next: 'next'
}

const defaults = {

  // Inflect the record type name in the URL.
  inflectType: true,

  // Inflect the names of the fields per record.
  inflectKeys: true,

  // Number of spaces to output to JSON.
  spaces: 2,

  // Default number of records to show per page.
  perPage: 1000,

  // What encoding to use for buffer fields.
  bufferEncoding: 'base64',

  // Hyperlink prefix.
  prefix: '',

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'

}

const inBrackets = /\[([^\]]+)\]/
const pageLimit = 'page[limit]'
const pageOffset = 'page[offset]'


export default Serializer => {

  /**
   * JSON API serializer.
   */
  class JsonApiSerializer extends Serializer {

    constructor () {
      super(...arguments)

      const options = this.options || {}

      Object.defineProperties(this, {

        // Set options.
        options: {
          value: Object.assign({}, defaults, options)
        },

        // Parse the URI template.
        uriTemplate: {
          value: uriTemplates(options.uriTemplate || defaults.uriTemplate)
        }

      })
    }


    processRequest (context) {
      // If the request was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      const request = arguments[1]

      return new Promise(resolve => {
        // Dumb body parsing that doesn't understand content encoding.
        const chunks = []

        request.on('data', chunk => chunks.push(chunk))

        request.on('end', () => {
          // Augment the request object with the content of the entire body.
          resolve(Buffer.concat(chunks))
        })
      })

      .then(payload => {

        const {
          uriTemplate, options, schemas, adapter, keys, errors, events
        } = this
        const uriObject = uriTemplate.fromUri(request.url)

        // Inflect type name.
        if (options.inflectType && uriObject.type)
          uriObject.type = inflection.singularize(uriObject.type)

        context.request.method = determineMethod.call(this, context, request)
        context.request.type = uriObject.type
        context.request.ids = (Array.isArray(uriObject.ids) ?
          uriObject.ids : [uriObject.ids])
          .map(id => {
            // Stolen from jQuery source code:
            // https://api.jquery.com/jQuery.isNumeric/
            const float = Number.parseFloat(id)
            return id - float + 1 >= 0 ? float : id
          })

        const { method, type, ids } = context.request
        const schema = schemas[type]
        const query = uriObject.query || {}

        if ('include' in query)
          context.request.include = query.include
            .split(',').map(i => i.split('.'))

        if (pageOffset in query)
          context.request.options.offset =
            Math.abs(parseInt(query[pageOffset], 10))

        if ('sort' in query)
          attachSort(query.sort, context.request, errors)

        // Handle sparse fields.
        attachFields(query, context.request)

        // Attach default limit.
        context.request.options.limit = pageLimit in query ?
          Math.abs(parseInt(query[pageLimit], 10)) : options.perPage

        if (payload.length)
          try {
            context.request.payload = payload.length ?
              JSON.parse(payload.toString()) : undefined
          } catch (error) {
            throw new errors.BadRequestError(`Error parsing JSON request.`)
          }

        const relatedField = uriObject.relatedField

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
          const relatedIds = [...(records || []).reduce((ids, record) => {
            const related = Array.isArray(record[relatedField]) ?
              record[relatedField] : [record[relatedField]]

            related.forEach(id => ids.add(id))

            return ids
          }, new Set())]

          // If there's no related IDs, and we're not trying to create
          // something, then something is missing.
          if (!relatedIds.length && method !== events.create)
            throw new errors.NotFoundError(
              `No related records match the request.`)

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
      })
    }


    processResponse (context) {
      const { payload, meta } = context.response
      const { options } = this

      if (arguments.length > 1 && payload && typeof payload === 'object')
        if (Object.keys(payload).length)
          context.response.payload =
          JSON.stringify(payload, function (key, value) {
            if (value && value.type === 'Buffer' && Array.isArray(value.data))
              return new Buffer(value.data).toString(options.bufferEncoding)

            return value
          }, options.spaces)
        else
          context.response.payload = undefined

      if (!meta) context.response.meta = {}
      if (payload) context.response.meta['Content-Type'] = mediaType

      return context
    }


    showResponse (context, records, include) {
      const { keys, events, errors, uriTemplate, options } = this

      if (!records)
        throw new errors.NotFoundError(`The index route is not defined.`)

      const prefix = 'prefix' in options ? options.prefix : defaults.prefix
      const { method, type, ids } = context.request
      const output = {}

      if (!ids.length && method !== events.create) {
        const { count } = records
        const { limit, offset } = context.request.options

        output[reservedKeys.meta] = { count }

        // Set top-level pagination links.
        if (count > limit) {
          const collection = prefix + uriTemplate.fillFromObject({
            type: options.inflectType ? inflection.pluralize(type) : type
          })

          output[reservedKeys.links] = Object.assign({
            [reservedKeys.first]: `${collection}?${pageOffset}=0` +
              `&${pageLimit}=${limit}`,
            [reservedKeys.last]: `${collection}?${pageOffset}=` +
              `${Math.floor(count / limit) * limit}&${pageLimit}=${limit}`
          },
          limit + (offset || 0) < count ? {
            [reservedKeys.next]: `${collection}?${pageOffset}=` +
              `${(Math.floor((offset || 0) / limit) + 1) * limit}` +
              `&${pageLimit}=${limit}`
          } : null,
          (offset || 0) >= limit ? {
            [reservedKeys.prev]: `${collection}?${pageOffset}=` +
              `${(Math.floor((offset || 0) / limit) - 1) * limit}` +
              `&${pageLimit}=${limit}`
          } : null)
        }
      }

      if (records.length) {
        output[reservedKeys.primary] = records.map(record =>
          mapRecord.call(this, type, record))

        if (ids.length === 1 ||
          (method === events.create && records.length === 1))
          output[reservedKeys.primary] = output[reservedKeys.primary][0]

        if (method === events.create)
          context.response.meta['Location'] = prefix +
          uriTemplate.fillFromObject({
            type: options.inflectType ? inflection.pluralize(type) : type,
            ids: records.map(record => record[keys.primary])
          })
      }

      // To show included records, we have to flatten them :(
      if (include) {
        output[reservedKeys.included] = []

        Object.keys(include).forEach(type => {
          output[reservedKeys.included].push(...include[type].map(record =>
            mapRecord.call(this, type, record)))
        })
      }

      context.response.payload = output

      return context
    }


    parseCreate (context) {
      const { keys, errors, schemas, options } = this
      const {
        payload, relatedField, relatedType, relatedIds, type
      } = context.request
      const schema = schemas[type]
      const data = payload[reservedKeys.primary]

      // No bulk extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      const records = [data].map(record => {
        const clone = {}

        if (record[reservedKeys.type] !== type)
          throw new errors.ConflictError(`Incorrect type.`)

        if (reservedKeys.id in record)
          clone[reservedKeys.id] = record[reservedKeys.id]

        if (reservedKeys.attributes in record)
          for (let field in record[reservedKeys.attributes]) {
            clone[field] = castValue(record[reservedKeys.attributes][field],
              schema[field] ? schema[field][keys.type] : null, options)
          }

        if (reservedKeys.links in record)
          Object.keys(record[reservedKeys.links]).forEach(field => {
            if (!(reservedKeys.linkage in record[reservedKeys.links][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.linkage}" field is missing.`)

            const relatedType = schema[field][keys.link]
            const relatedIsArray = schema[field][keys.isArray]
            const linkage = record[reservedKeys.links]
              [field][reservedKeys.linkage]

            clone[field] = linkage ? (Array.isArray(linkage) ?
              linkage : [linkage]).map(link => {
                if (link[reservedKeys.type] !== relatedType)
                  throw new errors.ConflictError(`Linkage object field ` +
                    `"$(reservedKeys.type)" is invalid, it must be ` +
                    `"$(relatedType)".`)

                return link[reservedKeys.id]
              }) : null

            if (clone[field] && !relatedIsArray)
              clone[field] = clone[field][0]
          })

        return clone
      })

      // Attach related field based on inverse.
      if (relatedField) {
        const field = schemas[relatedType]
          [relatedField][keys.inverse]
        const relatedArray = schemas[relatedType]
          [relatedField][keys.isArray]
        const isArray = schema[field][keys.isArray]

        if (records.length > 1 && !relatedArray)
          throw new errors.BadRequestError(`Too many records ` +
            `to be created, only one allowed.`)

        if (relatedIds.length > 1 && !isArray)
          throw new errors.BadRequestError(`Invalid request to ` +
            `associate many records to a singular relationship.`)

        records.forEach(record => {
          record[field] = isArray ? relatedIds : relatedIds[0]
        })
      }

      return records
    }


    parseUpdate (context) {
      const { errors, schemas, keys, options } = this
      const { payload, type, ids } = context.request
      const schema = schemas[type]
      const data = payload[reservedKeys.primary]

      // No bulk/patch extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      if (!ids.length)
        throw new errors.BadRequestError(`IDs unspecified.`)

      const updates = []

      ;([data]).forEach(update => {
        const replace = {}

        if (!arrayProxy.includes(ids, update[reservedKeys.id]))
          throw new errors.ConflictError(`Invalid ID.`)

        if (update[reservedKeys.type] !== type)
          throw new errors.ConflictError(`Incorrect type.`)

        if (reservedKeys.attributes in update)
          for (let field in update[reservedKeys.attributes]) {
            replace[field] = castValue(update[reservedKeys.attributes][field],
              schema[field] ? schema[field][keys.type] : null, options)
          }

        if (reservedKeys.links in update)
          Object.keys(update[reservedKeys.links]).forEach(field => {
            if (!(reservedKeys.linkage in update[reservedKeys.links][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.linkage}" field is missing.`)

            const relatedType = schema[field][keys.link]
            const relatedIsArray = schema[field][keys.isArray]
            const linkage = update[reservedKeys.links]
              [field][reservedKeys.linkage]

            replace[field] = linkage ? (Array.isArray(linkage) ?
              linkage : [linkage]).map(link => {
                if (link[reservedKeys.type] !== relatedType)
                  throw new errors.ConflictError(`Linkage object field ` +
                    `"$(reservedKeys.type)" is invalid, it must be ` +
                    `"$(relatedType)".`)

                return link[reservedKeys.id]
              }) : null

            if (replace[field] && !relatedIsArray)
              replace[field] = replace[field][0]
          })

        updates.push({
          id: update[reservedKeys.id],
          replace
        })
      })

      if (updates.length < ids.length)
        throw new errors.BadRequestError(`An update is missing.`)

      return updates
    }


    showError (context, error) {
      const { name, message } = error
      const errors = (Array.isArray(error) ? error : [error])
        .map(error => Object.assign({},
        name ? { title: name } : null,
        message ? { detail: message } : null,
        error))

      context.response.payload = {
        [reservedKeys.errors]: errors
      }

      return context
    }

  }

  JsonApiSerializer.id = mediaType

  return JsonApiSerializer

}

/**
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapRecord (type, record) {
  const { keys, options, uriTemplate, schemas } = this
  const prefix = 'prefix' in options ? options.prefix : defaults.prefix
  const id = record[keys.primary]
  delete record[keys.primary]

  const fields = new Set(Object.keys(record))

  record[reservedKeys.type] = type
  record[reservedKeys.id] = id.toString()
  record[reservedKeys.meta] = {}
  record[reservedKeys.attributes] = {}
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

    record[reservedKeys.links][field] = {
      self: prefix + uriTemplate.fillFromObject({
        type: options.inflectType ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: reservedKeys.links,
        relationship: field
      }),
      related: prefix + uriTemplate.fillFromObject({
        type: options.inflectType ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: field
      }),
      linkage: schemaField[keys.isArray] ?
        ids.map(toLinkage.bind(null, linkType)) :
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

  return record
}


function toLinkage (type, id) {
  return { [reservedKeys.type]: type, [reservedKeys.id]: id.toString() }
}


function castValue (value, type, options) {
  if (!type)
    return value

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), options.bufferEncoding)

  return value
}


function attachFields (query, request) {
  Object.keys(query).forEach(parameter => {
    if (parameter.match(/^fields/)) {
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
  })
}


function attachSort (sort, request, errors) {
  sort = Array.isArray(sort) ? sort : [sort]

  request.options.sort = sort.reduce((sort, field) => {
    const firstChar = field.charAt(0)

    if (firstChar !== '+' && firstChar !== '-')
      throw new errors.BadRequestError(
        `A sort order must be specified.`)

    sort[field.slice(1)] = firstChar === '+' ? 1 : -1

    return sort
  }, {})
}


/**
 * Internal function to determine the method based on the HTTP method, there
 * are unusual cases in which PATCH can create records, according to the
 * official patch extension.
 */
function determineMethod (context, request) {
  const { events } = this

  const handlers = {
    GET: events.find,
    POST: events.create,
    PATCH: events.update,
    DELETE: events.delete
  }

  const handler = handlers[request.method]

  return typeof handler === 'function' ? handler(...arguments) : handler
}
