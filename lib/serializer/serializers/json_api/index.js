import uriTemplates from 'uri-templates'
import inflection from 'inflection'


const mediaType = 'application/vnd.api+json'

const specKeys = {
  primary: 'data',
  links: 'links',
  self: 'self',
  type: 'type',
  id: 'id'
}

const defaults = {
  inflect: {
    type: true,
    keys: true
  },
  spaces: 0,
  bufferEncoding: 'base64',
  extensions: [ 'patch', 'bulk' ],
  prefix: 'http://example.com',
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'
}

// TODO: PUT, PATCH
const handlers = {
  GET: 'find',
  POST: 'create',
  DELETE: 'delete'
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

      const request = arguments[1]
      const uriObject = this.uriTemplate.fromUri(request.url)

      // Inflect type name.
      if (this.options.inflect.type)
        uriObject.type = inflection.singularize(uriObject.type)

      context.request.action = determineAction(context, request)

      const type = context.request.type = uriObject.type
      const ids = context.request.ids = uriObject.ids || []
      const { payload } = context.request
      const { errors } = this

      if (payload && typeof payload !== 'object')
        try {
          context.request.payload = JSON.parse(payload)
        } catch (error) {
          throw new errors.BadRequestError(
            `Error parsing JSON request.`)
        }

      const relatedField = uriObject.relatedField

      if (relatedField && !this.schemas[type].hasOwnProperty(relatedField))
        throw new errors.NotFoundError(`The field "${relatedField}" is ` +
          `non-existent on the type "${type}".`)

      return relatedField ? this.adapter.find(type, ids, {
        // We only care about getting the related field.
        fields: { [relatedField]: true }
      })

      .then(records => {
        // Reduce the related IDs from all of the records into an array of
        // unique IDs.
        const relatedIds = [...(records || []).reduce((ids, record) => {
          const related = record[relatedField];

          (Array.isArray(related) ? related : [related])
            .forEach(id => ids.add(id))

          return ids
        }, new Set())]

        // If there's no related IDs, and we're not trying to create something,
        // then something is missing.
        if (!relatedIds.length && context.request.action !== 'create')
          throw new errors.NotFoundError(
            `No related records match the request.`)

        const relatedType = this.schemas[type][relatedField][this.keys.link]

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
      const { payload } = context.response
      const { options } = this

      if (typeof payload === 'object')
        if (Object.keys(payload).length)
          context.response.payload =
            JSON.stringify(payload, function (key, value) {
              return Buffer.isBuffer(value) ?
                value.toString(options.bufferEncoding) : value
            }, options.spaces)
        else
          context.response.payload = undefined

      context.response.meta['Content-Type'] = mediaType

      return context
    }


    showResponse (context, records) {
      const { type } = context.request
      const output = {}

      if (records && records.length) {
        output[specKeys.primary] = records.map(record =>
          mapRecord.call(this, type, record))

        if (output[specKeys.primary].length === 1)
          output[specKeys.primary] = output[specKeys.primary][0]
      }

      context.response.payload = output

      return context
    }


    // TODO: Actually parse the stupid JSON API format,
    // bulk create option checking.
    parseCreate (context) {
      const { keys, errors } = this
      const {
        payload, relatedField, relatedType, relatedIds, type
      } = context.request
      const data = payload[specKeys.primary]
      const records = Array.isArray(data) ? data : [data]

      // Attach related field based on inverse.
      if (relatedField) {
        const field = this.schemas[relatedType]
          [relatedField][keys.inverse]
        const relatedArray = this.schemas[relatedType]
          [relatedField][keys.isArray]
        const isArray = this.schemas[type][field][keys.isArray]

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
  const { keys, options } = this
  const prefix = options.hasOwnProperty('prefix') ?
      options.prefix : defaults.prefix
  const id = record[keys.primary]

  delete record[keys.primary]

  record[specKeys.id] = id.toString()
  record[specKeys.type] = type

  record[specKeys.links] = {
    [specKeys.self]: prefix + this.uriTemplate.fillFromObject({
      type: this.options.inflect.type ? inflection.pluralize(type) : type,
      ids: id
    })
  }

  for (let field in record) {
    const schemaField = this.schemas[type][field]

    // Per the recommendation, dasherize keys.
    if (this.options.inflect.keys && !specKeys.hasOwnProperty(field)) {
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

    record[specKeys.links][field] = {
      // TODO: this bullshit
      self: prefix + this.uriTemplate.fillFromObject({
        type: this.options.inflect.type ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: specKeys.links,
        relationship: field
      }),
      related: prefix + this.uriTemplate.fillFromObject({
        type: this.options.inflect.type ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: field
      }),
      linkage: schemaField[keys.isArray] ?
        ids.map(toLinkage.bind(null, linkType)) :
        (ids ? { [specKeys.type]: linkType, [specKeys.id]: ids.toString() } :
          null)
    }
  }

  return record
}


function toLinkage (type, id) {
  return { [specKeys.type]: type, [specKeys.id]: id.toString() }
}


/*!
 * Internal function to determine the action based on the HTTP method,
 * there are edge cases in which PUT and PATCH can create records.
 */
function determineAction (context, request) {
  const handler = handlers[request.method]

  return typeof handler === 'function' ? handler(...arguments) : handler
}
