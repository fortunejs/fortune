import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys,
  defaults } from './settings'
import { processData, initializeContext,
  stringifyObject } from './helpers'


export default Serializer => {
  /**
   * Micro API serializer.
   */
  class MicroApiSerializer extends Serializer {

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
      // If the request was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      const request = arguments[1]

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


    showIndex (context) {
      const { schemas, options, uriTemplate, keys } = this
      const output = { [reservedKeys.links]: {} }

      for (let type in schemas) {
        const schema = schemas[type]

        output[reservedKeys.links][type] = {
          [reservedKeys.href]: uriTemplate.fillFromObject({
            type: options.inflectType ? inflection.pluralize(type) : type
          })
        }

        for (let field in schema) {
          const linkedType = schema[field][keys.link]

          if (linkedType) {
            const linkedField = schema[field][keys.inverse]

            output[reservedKeys.links][type][field] = Object.assign({
              [reservedKeys.type]: linkedType,
              [reservedKeys.array]: Boolean(schema[field][keys.isArray])
            }, !schemas[linkedType][linkedField][keys.denormalizedInverse] ? {
              [reservedKeys.inverse]: linkedField
            } : null)
          }
        }
      }

      context.response.payload = output

      return context
    }


    showResponse (context, records) {
      if (!records)
        return this.showIndex(context)

      // TODO: show records.

      return context
    }


    showError (context, error) {
      const { nativeErrors } = this.errors
      const { name, message } = error
      const output = {}

      output[reservedKeys.error] = !nativeErrors.has(error.constructor) ?
        Object.assign({},
          name ? { name } : null,
          message ? { message } : null,
          error) :
        {
          name: 'Error',
          message: 'An internal server error occured.'
        }

      context.response.payload = output

      return context
    }


    parseCreate (context) {
      const { keys, errors, schemas } = this
      const {
        type, payload, relatedField, relatedType, relatedIds
      } = context.request

      if (!(type in payload))
        throw new errors.BadRequestError(
          `The type to be created is missing in the payload.`)

      if (!Array.isArray(payload[type]))
        throw new errors.BadRequestError(
          `The type field must be valued as an array of records.`)

      const schema = schemas[type]
      const records = payload[type]

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

        for (let record of records)
          record[field] = isArray ? relatedIds : relatedIds[0]
      }

      return records
    }

  }

  MicroApiSerializer.id = mediaType

  return MicroApiSerializer
}
