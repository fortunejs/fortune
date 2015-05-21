import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import * as arrayProxy from '../../../common/array_proxy'
import { processData, methodMap } from '../../../net/http'


// JSON API is an highly verbose and ambiguous specification. There are many
// trade-offs made in an attempt to cover everyone's use cases, such as
// resource identifier objects for polymorphic link fields, and relationship
// entities which are an entirely unnecessary complication. More importantly,
// it assumes tight coupling with the API consumer and the HTTP protocol. For
// example, it assumes that the client has *a priori* knowledge of types that
// exist on the server, since it does not define an entry point.
//
// The format is painful to implement and the specification is pretty long,
// I would not recommend doing it yourself unless you're a masochist like me.


const mediaType = 'application/vnd.api+json'

// Reserved keys from the JSON API specification.
const reservedKeys = {
  // Document structure.
  primary: 'data',
  attributes: 'attributes',
  relationships: 'relationships',
  type: 'type',
  id: 'id',
  meta: 'meta',
  errors: 'errors',
  included: 'included',

  // Hypertext.
  links: 'links',
  related: 'related',
  self: 'self',

  // Reserved query strings.
  include: 'include',
  fields: 'fields',
  filter: 'filter',
  sort: 'sort',
  page: 'page',

  // Pagination keys.
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

  // Maximum number of records to show per page.
  pageLimit: 1000,

  // Maximum number of fields per include.
  includeDepth: 3,

  // What encoding to use for buffer fields.
  bufferEncoding: 'base64',

  // Hyperlink prefix.
  prefix: '',

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'

}

const inBrackets = /\[([^\]]+)\]/
const isField = new RegExp(`^${reservedKeys.fields}`)
const isFilter = new RegExp(`^${reservedKeys.filter}`)
const pageLimit = `${reservedKeys.page}[limit]`
const pageOffset = `${reservedKeys.page}[offset]`


export default Serializer => {

  /**
   * JSON API serializer.
   */
  class JsonApiSerializer extends Serializer {

    constructor () {
      super(...arguments)

      const { options } = this

      // Set options.
      for (let key in defaults) if (!(key in options))
        options[key] = defaults[key]

      Object.defineProperties(this, {

        // Parse the URI template.
        uriTemplate: { value: uriTemplates(
          (options || {}).uriTemplate || defaults.uriTemplate) },

        // Default method mapping.
        methodMap: { value: methodMap }

      })
    }


    processRequest (context) {
      // If the dispatch was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      const request = arguments[1]

      const {
        uriTemplate, methodMap,
        options, schemas, adapter, keys, errors, methods
      } = this

      const uriObject = uriTemplate.fromUri(request.url)

      return processData(request)

      .then(payload => {
        context.request.method = methodMap[request.method]

        context.request.type = options.inflectType && uriObject.type ?
          inflection.singularize(uriObject.type) : uriObject.type

        context.request.ids = uriObject.ids ?
          (Array.isArray(uriObject.ids) ?
          uriObject.ids : [uriObject.ids])
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
          const relatedIds = [...(records || []).reduce((ids, record) => {
            const value = record[relatedField]

            if (Array.isArray(value)) value.forEach(id => ids.add(id))
            else ids.add(value)

            return ids
          }, new Set())]

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
      })
    }


    processResponse (context) {
      // If the dispatch was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      let { payload, meta } = context.response
      const { options } = this

      if (!meta) meta = context.response.meta = {}

      if (payload && typeof payload === 'object') {
        payload = context.response.payload =
          JSON.stringify(payload, function (key, value) {
            if (value && value.type === 'Buffer' && Array.isArray(value.data))
              return new Buffer(value.data).toString(options.bufferEncoding)

            return value
          }, options.spaces)

        meta['Content-Type'] = mediaType
      }

      return context
    }


    showIndex () {
      const { errors } = this

      throw new errors.NotFoundError(
        `The index route is not defined by JSON API.`)
    }


    showResponse (context, records, include) {
      const { keys, methods, errors, uriTemplate, options, schemas } = this

      if (!records)
        return this.showIndex(context)

      const { method, type, ids, relatedField, relationship,
        originalType, originalIds } = context.request

      if (relationship)
        return this.showRelationship(...arguments)

      // Handle a not found error.
      if (ids && ids.length && method === methods.find &&
        !relatedField && !records.length)
        throw new errors.NotFoundError(`No records match the request.`)

      // Delete and update requests shouldn't respond with anything.
      if (method === methods.delete || method === methods.update)
        return context

      const prefix = 'prefix' in options ? options.prefix : defaults.prefix
      const output = {}

      // Show collection.
      if (!ids && method === methods.find) {
        const { count } = records
        const { limit, offset } = context.request.options
        const collection = prefix + uriTemplate.fillFromObject({
          type: options.inflectType ? inflection.pluralize(type) : type
        })

        output[reservedKeys.meta] = { count }
        output[reservedKeys.links] = {
          [reservedKeys.self]: collection
        }
        output[reservedKeys.primary] = []

        // Set top-level pagination links.
        if (count > limit)
          Object.assign(output[reservedKeys.links], {
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

      if (records.length) {
        if (ids)
          output[reservedKeys.links] = {
            [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
              type: options.inflectType ? inflection.pluralize(type) : type,
              ids
            })
          }
        output[reservedKeys.primary] = records.map(record =>
          mapRecord.call(this, type, record))

        if ((ids && ids.length === 1) ||
          (method === methods.create && records.length === 1))
          output[reservedKeys.primary] = output[reservedKeys.primary][0]

        if (method === methods.create)
          context.response.meta['Location'] = prefix +
          uriTemplate.fillFromObject({
            type: options.inflectType ? inflection.pluralize(type) : type,
            ids: records.map(record => record[keys.primary])
          })
      } else if (relatedField && method === methods.find) {
        output[reservedKeys.links] = {
          [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
            type: options.inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds,
            relatedField
          })
        }
        output[reservedKeys.primary] = schemas[originalType]
          [relatedField][keys.isArray] ? [] : null
      }

      // To show included records, we have to flatten them :(
      if (include) {
        output[reservedKeys.included] = []

        Object.keys(include).forEach(type => {
          output[reservedKeys.included].push(...include[type].map(record =>
            mapRecord.call(this, type, record)))
        })
      }

      if (Object.keys(output).length)
        context.response.payload = output

      return context
    }


    showRelationship (context, records) {
      const { method, type,
        relatedField, originalType, originalIds
      } = context.request
      const { keys, errors, uriTemplate, options, schemas, methods } = this

      if (originalIds.length > 1)
        throw new errors.NotFoundError(
          `Can only show relationships for one record at a time.`)

      if (method !== methods.find)
        return context

      const prefix = 'prefix' in options ? options.prefix : defaults.prefix

      const output = {
        [reservedKeys.links]: {
          [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
            type: options.inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds, relatedField: reservedKeys.relationships,
            relationship: relatedField
          }),
          [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
            type: options.inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds, relatedField
          })
        }
      }

      const isArray = schemas[originalType][relatedField][keys.isArray]
      const identifiers = records.map(record => ({
        [reservedKeys.type]: type,
        [reservedKeys.id]: record[keys.primary]
      }))

      output[reservedKeys.primary] = isArray ? identifiers :
        identifiers.length ? identifiers[0] : null

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

        if (reservedKeys.relationships in record)
          Object.keys(record[reservedKeys.relationships]).forEach(field => {
            if (!(reservedKeys.primary in
              record[reservedKeys.relationships][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.primary}" field is missing.`)

            const relatedType = schema[field][keys.link]
            const relatedIsArray = schema[field][keys.isArray]
            const data = record[reservedKeys.relationships]
              [field][reservedKeys.primary]

            clone[field] = data ? (Array.isArray(data) ?
              data : [data]).map(link => {
                if (link[reservedKeys.type] !== relatedType)
                  throw new errors.ConflictError(`Data object field ` +
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
      const { payload, type, ids, relationship } = context.request

      if (relationship)
        return this.updateRelationship(...arguments)

      const { errors, schemas, keys, options } = this
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

        if (reservedKeys.relationships in update)
          Object.keys(update[reservedKeys.relationships]).forEach(field => {
            if (!(reservedKeys.primary in
              update[reservedKeys.relationships][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.primary}" field is missing.`)

            const relatedType = schema[field][keys.link]
            const relatedIsArray = schema[field][keys.isArray]
            const data = update[reservedKeys.relationships]
              [field][reservedKeys.primary]

            replace[field] = data ? (Array.isArray(data) ?
              data : [data]).map(link => {
                if (link[reservedKeys.type] !== relatedType)
                  throw new errors.ConflictError(`Data object field ` +
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


    updateRelationship (context) {
      const { schemas, keys, errors, methods } = this
      const { payload, type, relatedField,
        originalMethod, originalType, originalIds
      } = context.request
      const isArray = schemas[originalType][relatedField][keys.isArray]

      if (originalIds.length > 1)
        throw new errors.NotFoundError(
          `Can only update relationships for one record at a time.`)

      if (!isArray && originalMethod)
        throw new errors.MethodError(`Can not ` +
          originalMethod === methods.create ? 'push to' : 'pull from' +
          ` a to-one relationship.`)

      const updates = []
      const operation = originalMethod ? originalMethod === methods.create ?
        'push' : 'pull' : 'replace'
      let updateIds = payload[reservedKeys.primary]

      if (!isArray)
        if(!Array.isArray(updateIds)) updateIds = [updateIds]
        else throw new errors.BadRequestError(`Data must be singular.`)

      updateIds = updateIds.map(update => {
        if (update[reservedKeys.type] !== type)
          throw new errors.ConflictError(`Incorrect type.`)

        if (!(reservedKeys.id in update))
          throw new errors.BadRequestError(`ID is unspecified.`)

        return update[reservedKeys.id]
      })

      updates.push({
        id: originalIds[0],
        [operation]: {
          [relatedField]: isArray ? updateIds : updateIds[0]
        }
      })

      // Rewrite type and IDs.
      context.request.type = originalType
      context.request.ids = undefined
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


function castValue (value, type, options) {
  if (!type)
    return value

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), options.bufferEncoding)

  return value
}


function attachQueries (context, query, options) {
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
