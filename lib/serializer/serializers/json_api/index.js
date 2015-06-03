import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys, defaults,
  pageLimit, pageOffset } from './settings'
import { mapRecord, mapId, castValue, initializeContext,
  processData, stringifyObject } from './helpers'
import * as arrayProxy from '../../../common/array_proxy'


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


export default Serializer => {
  /**
   * JSON API serializer.
   */
  class JsonApiSerializer extends Serializer {

    constructor () {
      super(...arguments)

      const { options, methods } = this

      const methodMap = {
        GET: methods.find,
        POST: methods.create,
        PATCH: methods.update,
        DELETE: methods.delete
      }

      // Set options.
      for (let key in defaults) if (!(key in options))
        options[key] = defaults[key]

      const uriTemplate = uriTemplates(options ?
        options.uriTemplate : null || defaults.uriTemplate)

      Object.defineProperties(this, {

        // Parse the URI template.
        uriTemplate: { value: uriTemplate },

        // Default method mapping.
        methodMap: { value: methodMap }

      })
    }


    processRequest (context) {
      // If the dispatch was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1) return context

      const { errors } = this
      const request = arguments[1]
      const { serializerInput } = context.request

      // According to the spec, no accept parameters.
      if (request.headers['accept'] && ~request.headers['accept'].indexOf(';'))
        throw new errors.NotAcceptable(
          `Accept parameters are not allowed.`)

      // According to the spec, no content-type parameters.
      if (request.headers['content-type'] &&
      ~request.headers['content-type'].indexOf(';'))
        throw new errors.UnsupportedError(
          `Media type parameters are not allowed.`)

      // Not according to the spec but probably a good idea in practice, do not
      // allow a different media type for input.
      if (serializerInput && serializerInput !== mediaType)
        throw new errors.UnsupportedError(
          `Can not use a different media type as an input.`)

      return processData(request)
      .then(initializeContext.bind(this, context, request))
    }


    processResponse (context) {
      // If the dispatch was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      let { payload, meta } = context.response
      const { options } = this

      if (!meta) meta = context.response.meta = {}

      if (payload && typeof payload === 'object') {
        payload = stringifyObject(payload, options)

        context.response.payload = payload

        meta['Content-Type'] = mediaType
        meta['Content-Length'] = payload.length
      }

      return context
    }


    // Ad-hoc entry point implementation.
    showIndex (context) {
      const { recordTypes, options, uriTemplate } = this
      const { inflectType } = options
      const output = { [reservedKeys.meta]: {} }

      for (let type in recordTypes)
        output[reservedKeys.meta][type] = {
          [reservedKeys.href]: uriTemplate.fillFromObject({
            type: inflectType ? inflection.pluralize(type) : type
          })
        }

      context.response.payload = output

      return context
    }


    showResponse (context, records, include) {
      const { keys, methods, errors, uriTemplate, options, recordTypes } = this

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

      const { prefix, inflectType } = options
      const output = {}

      // Show collection.
      if (!ids && method === methods.find) {
        const { count } = records
        const { limit, offset } = context.request.options
        const collection = prefix + uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type
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
              type: inflectType ? inflection.pluralize(type) : type,
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
            type: inflectType ? inflection.pluralize(type) : type,
            ids: records.map(record => record[keys.primary])
          })
      }

      // Find related records.
      else if (relatedField && method === methods.find) {
        output[reservedKeys.links] = {
          [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
            type: inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds,
            relatedField
          })
        }
        output[reservedKeys.primary] = recordTypes[originalType]
          [relatedField][keys.isArray] ? [] : null
      }

      // To show included records, we have to flatten them :(
      if (include) {
        output[reservedKeys.included] = []

        for (let type of Object.keys(include))
          output[reservedKeys.included].push(...include[type]
            .map(mapRecord.bind(this, type)))
      }

      if (Object.keys(output).length)
        context.response.payload = output

      return context
    }


    showRelationship (context, records) {
      const { method, type,
        relatedField, originalType, originalIds
      } = context.request
      const { keys, errors, uriTemplate, options, recordTypes, methods } = this

      if (originalIds.length > 1)
        throw new errors.BadRequestError(
          `Can only show relationships for one record at a time.`)

      if (method !== methods.find)
        return context

      const { prefix, inflectType } = options

      const output = {
        [reservedKeys.links]: {

          [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
            type: inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds, relatedField: reservedKeys.relationships,
            relationship: relatedField
          }),

          [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
            type: inflectType ?
              inflection.pluralize(originalType) : originalType,
            ids: originalIds, relatedField
          })

        }
      }

      const isArray = recordTypes[originalType][relatedField][keys.isArray]
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
      const { keys, errors, recordTypes, options } = this
      const { payload, relatedField, type } = context.request
      const fields = recordTypes[type]

      // No related record creation.
      if (relatedField)
        throw new errors.MethodError(`Can not create related record.`)

      let data = payload[reservedKeys.primary]

      // No bulk extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      data = [ data ]

      return data.map(record => {
        const clone = {}

        if (record[reservedKeys.type] !== type)
          throw new errors.ConflictError(`Incorrect type.`)

        if (reservedKeys.id in record)
          clone[reservedKeys.id] = record[reservedKeys.id]

        if (reservedKeys.attributes in record)
          for (let field in record[reservedKeys.attributes]) {
            clone[field] = castValue(record[reservedKeys.attributes][field],
              fields[field] ? fields[field][keys.type] : null, options)
          }

        if (reservedKeys.relationships in record)
          for (let field of Object.keys(record[reservedKeys.relationships])) {
            if (!(reservedKeys.primary in
              record[reservedKeys.relationships][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.primary}" field is missing.`)

            const relatedType = fields[field][keys.link]
            const relatedIsArray = fields[field][keys.isArray]
            const data = record[reservedKeys.relationships]
              [field][reservedKeys.primary]

            clone[field] = data ? (Array.isArray(data) ? data : [ data ])
              .map(mapId.bind(this, relatedType)) : null

            if (clone[field] && !relatedIsArray)
              clone[field] = clone[field][0]
          }

        return clone
      })
    }


    parseUpdate (context) {
      const { errors, recordTypes, keys, options } = this
      const { payload, type, ids,
        relatedField, relationship
      } = context.request

      if (relationship)
        return this.updateRelationship(...arguments)

      // No related record update.
      if (relatedField) throw new errors.MethodError(
        `Can not update related record indirectly.`)

      // Can't update collections.
      if (!Array.isArray(ids) || !ids.length)
        throw new errors.BadRequestError(`IDs unspecified.`)

      const fields = recordTypes[type]
      const updates = []
      let data = payload[reservedKeys.primary]

      // No bulk/patch extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      data = [ data ]

      for (let update of data) {
        const replace = {}

        if (!arrayProxy.includes(ids, update[reservedKeys.id]))
          throw new errors.ConflictError(`Invalid ID.`)

        if (update[reservedKeys.type] !== type)
          throw new errors.ConflictError(`Incorrect type.`)

        if (reservedKeys.attributes in update)
          for (let field in update[reservedKeys.attributes]) {
            replace[field] = castValue(update[reservedKeys.attributes][field],
              fields[field] ? fields[field][keys.type] : null, options)
          }

        if (reservedKeys.relationships in update)
          for (let field of Object.keys(update[reservedKeys.relationships])) {
            if (!(reservedKeys.primary in
              update[reservedKeys.relationships][field]))
              throw new errors.BadRequestError(`The ` +
                `"${reservedKeys.primary}" field is missing.`)

            const relatedType = fields[field][keys.link]
            const relatedIsArray = fields[field][keys.isArray]
            const data = update[reservedKeys.relationships]
              [field][reservedKeys.primary]

            replace[field] = data ? (Array.isArray(data) ? data : [ data ])
              .map(mapId.bind(this, relatedType)) : null

            if (replace[field] && !relatedIsArray)
              replace[field] = replace[field][0]
          }

        updates.push({
          id: update[reservedKeys.id],
          replace
        })
      }

      if (updates.length < ids.length)
        throw new errors.BadRequestError(`An update is missing.`)

      return updates
    }


    updateRelationship (context) {
      const { recordTypes, keys, errors, methods } = this
      const { payload, type, relatedField,
        originalMethod, originalType, originalIds
      } = context.request
      const isArray = recordTypes[originalType][relatedField][keys.isArray]

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
        if (!Array.isArray(updateIds)) updateIds = [ updateIds ]
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
      const { nativeErrors } = this.errors
      const { name, message } = error

      error = !nativeErrors.has(error.constructor) ?
        Object.assign({},
          name ? { title: name } : null,
          message ? { detail: message } : null,
          error) :
        {
          name: 'Error',
          detail: 'An internal server error occured.'
        }

      context.response.payload = {
        [reservedKeys.errors]: [ error ]
      }

      return context
    }

  }

  JsonApiSerializer.id = mediaType

  return JsonApiSerializer
}
