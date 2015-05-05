import uriTemplates from 'uri-templates'
import inflection from 'inflection'


const mediaType = 'application/vnd.api+json'

// Reserved keys from the JSON API specification.
const reservedKeys = {
  primary: 'data',
  links: 'links',
  self: 'self',
  type: 'type',
  id: 'id'
}

const defaults = {

  // Inflect the record type name in the URL.
  inflecttype: true,

  // Inflect the names of the fields per record.
  inflectKeys: true,

  // Number of spaces to output to JSON.
  spaces: 2,

  // Output to buffer.
  outputBuffer: true,

  bufferEncoding: 'base64',

  // Official JSON API extensions.
  extensions: [ 'patch', 'bulk' ],

  // Hyperlink prefix.
  prefix: '',

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'

}


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

      const {
        uriTemplate, options, schemas, adapter, keys, errors, events
      } = this
      const request = arguments[1]
      const uriObject = uriTemplate.fromUri(request.url)

      // Inflect type name.
      if (options.inflectType && uriObject.type)
        uriObject.type = inflection.singularize(uriObject.type)

      context.request.method = determineMethod.call(this, context, request)
      context.request.type = uriObject.type
      context.request.ids = uriObject.ids || []
      const { method, type, ids, payload } = context.request

      if (payload && (typeof payload !== 'object' || Buffer.isBuffer(payload)))
        try {
          if (payload.length)
            context.request.payload = JSON.parse(payload.toString())
        } catch (error) {
          throw new errors.BadRequestError(`Error parsing JSON request.`)
        }

      const relatedField = uriObject.relatedField

      if (relatedField && !schemas[type].hasOwnProperty(relatedField))
        throw new errors.NotFoundError(`The field "${relatedField}" is ` +
          `non-existent on the type "${type}".`)

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

        // If there's no related IDs, and we're not trying to create something,
        // then something is missing.
        if (!relatedIds.length && method !== events.create)
          throw new errors.NotFoundError(
            `No related records match the request.`)

        const relatedType = schemas[type][relatedField][keys.link]

        // Copy the original type and IDs to temporary keys.
        context.request.relatedField = relatedField
        context.request.originalType = type
        context.request.originalIds = ids

        // Write the related info to the request, which should take precedence
        // over the original type and IDs.
        context.request.type = relatedType
        context.request.ids = relatedIds

        return context
      }) : context
    }


    processResponse (context) {
      const { payload, meta } = context.response
      const { options } = this

      if (options.outputBuffer && typeof payload === 'object')
        if (Object.keys(payload).length)
          context.response.payload = new Buffer(
            JSON.stringify(payload, function (key, value) {
              if (Buffer.isBuffer(value))
                return value.toString(options.bufferEncoding)

              return value
            }, options.spaces))
        else
          context.response.payload = undefined

      if (!meta) context.response.meta = {}
      context.response.meta['Content-Type'] = mediaType

      return context
    }


    showResponse (context, records) {
      const { type } = context.request
      const output = {}

      if (records && records.length) {
        output[reservedKeys.primary] = records.map(record =>
          mapRecord.call(this, type, record))

        if (output[reservedKeys.primary].length === 1)
          output[reservedKeys.primary] = output[reservedKeys.primary][0]
      }

      context.response.payload = output

      return context
    }


    // TODO: Actually parse the stupid JSON API format,
    // bulk create option checking.
    parseCreate (context) {
      const { keys, errors, schemas } = this
      const {
        payload, relatedField, relatedType, relatedIds, type
      } = context.request
      const data = payload[reservedKeys.primary]
      const records = Array.isArray(data) ? data : [data]

      // Attach related field based on inverse.
      if (relatedField) {
        const field = schemas[relatedType]
          [relatedField][keys.inverse]
        const relatedArray = schemas[relatedType]
          [relatedField][keys.isArray]
        const isArray = schemas[type][field][keys.isArray]

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


    showError (context, error) {
      const errors = (Array.isArray(error) ? error : [error])
        .map(error => Object.assign({
          title: error.name,
          detail: error.message
        }, error))

      context.response.payload = { errors }

      return context
    }

  }

  JsonApiSerializer.id = mediaType

  return JsonApiSerializer

}

/*!
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapRecord (type, record) {
  const { keys, options, uriTemplate, schemas } = this
  const prefix = options.hasOwnProperty('prefix') ?
      options.prefix : defaults.prefix
  const id = record[keys.primary]

  delete record[keys.primary]

  record[reservedKeys.id] = id.toString()
  record[reservedKeys.type] = type

  record[reservedKeys.links] = {
    [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
      type: options.inflectType ? inflection.pluralize(type) : type,
      ids: id
    })
  }

  for (let field in record) {
    const schemaField = schemas[type][field]

    // Per the recommendation, dasherize keys.
    if (options.inflectKeys && !reservedKeys.hasOwnProperty(field)) {
      const value = record[field]
      delete record[field]
      record[inflection.transform(field,
        [ 'underscore', 'dasherize' ])] = value
    }

    // If it's not a link we can continue.
    if (!schemaField || !schemaField[keys.link])
      continue

    let ids = record[field]
    delete record[field]

    if (!schemaField[keys.isArray] && Array.isArray(ids))
      ids = ids[0]

    if (schemaField[keys.isArray] && !Array.isArray(ids))
      ids = [ids]

    const linkType = schemaField[keys.link]

    record[reservedKeys.links][field] = {
      // TODO: this bullshit
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
  }

  return record
}


function toLinkage (type, id) {
  return { [reservedKeys.type]: type, [reservedKeys.id]: id.toString() }
}


/**
 * Internal function to determine the method based on the HTTP method,
 * there are unusual cases in which PUT and PATCH can create records.
 */
function determineMethod (context, request) {
  const { events } = this

  // TODO: PUT, PATCH
  const handlers = {
    get: events.find,
    post: events.create,
    delete: events.delete
  }

  const handler = handlers[request.method.toLowerCase()]

  return typeof handler === 'function' ? handler(...arguments) : handler
}
