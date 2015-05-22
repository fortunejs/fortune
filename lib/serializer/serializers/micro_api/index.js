import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { processData, methodMap } from '../../../net/http'
import { mediaType, reservedKeys, defaults } from './settings'
import { attachQueries } from './helpers'


export default Serializer => {

  /**
   * Micro API serializer.
   */
  class MicroApiSerializer extends Serializer {

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
      // If the request was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      const request = arguments[1]

      const {
        uriTemplate, methodMap,
        options, schemas, adapter, keys, errors
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
          const relatedIds = [...(records || []).reduce((ids, record) => {
            const value = record[relatedField]

            if (Array.isArray(value)) value.forEach(id => ids.add(id))
            else ids.add(value)

            return ids
          }, new Set())]

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
          if (schema[field][keys.link])
            output[reservedKeys.links][type][field] = {
              [reservedKeys.type]: schema[field][keys.link],
              [reservedKeys.array]: Boolean(schema[field][keys.isArray]),
              [reservedKeys.inverse]: schema[field][keys.inverse]
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
      const { name, message } = error
      const output = {}

      output[reservedKeys.error] = Object.assign({},
        name ? { name } : null,
        message ? { message } : null,
        error)

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

        records.forEach(record => {
          record[field] = isArray ? relatedIds : relatedIds[0]
        })
      }

      return records
    }

  }

  MicroApiSerializer.id = mediaType

  return MicroApiSerializer

}
