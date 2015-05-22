import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import * as arrayProxy from '../../../common/array_proxy'
import {
  mediaType, reservedKeys, defaults, pageLimit, pageOffset
} from './settings'
import {
  mapRecord, castValue, attachQueries, processData
} from './helpers'


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

      // Set options.
      for (let key in defaults) if (!(key in options))
        options[key] = defaults[key]

      Object.defineProperties(this, {

        // Parse the URI template.
        uriTemplate: { value: uriTemplates(
          (options || {}).uriTemplate || defaults.uriTemplate) },

        // Default method mapping.
        methodMap: {
          value: {
            GET: methods.find,
            POST: methods.create,
            PATCH: methods.update,
            DELETE: methods.delete
          }
        }

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

            if (Array.isArray(value)) value.forEach(id => ids.add(id))
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
          JSON.stringify(payload, (key, value) => {
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
      }
      else if (relatedField && method === methods.find) {
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
      let data = payload[reservedKeys.primary]

      // No bulk extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      data = [ data ]

      const records = data.map(record => {
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
              data : [ data ]).map(link => {
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
      const updates = []
      let data = payload[reservedKeys.primary]

      // No bulk/patch extension for now.
      if (Array.isArray(data))
        throw new errors.BadRequestError(`Data must be singular.`)

      data = [ data ]

      if (!ids.length)
        throw new errors.BadRequestError(`IDs unspecified.`)

      data.forEach(update => {
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
              data : [ data ]).map(link => {
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

      error = !nativeErrors.has(error) ?
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
