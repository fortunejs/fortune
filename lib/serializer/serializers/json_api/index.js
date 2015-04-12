import uriTemplates from 'uri-templates'
import inflection from 'inflection'


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
  extensions: ['patch', 'bulk'],
  prefix: 'http://example.com',
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'
}

// TODO: PUT, PATCH
const handlers = {
  GET: 'find',
  POST: 'create',
  DELETE: 'delete'
}


/**
 * JSON API serializer.
 */
export default Serializer => {
  class JsonApiSerializer extends Serializer {

    constructor () {
      super(...arguments)

      Object.defineProperties(this, {

        // Set options.
        options: {
          value: Object.assign(defaults, this.options)
        },

        // Parse the URI template.
        uriTemplate: {
          value: uriTemplates(
            this.options.uriTemplate || defaults.uriTemplate)
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

      if (payload && typeof payload !== 'object')
        try {
          context.request.payload = JSON.parse(payload)
        } catch (error) {
          throw new this.errors.BadRequestError(
            `Error parsing JSON request.`)
        }

      const relatedField = uriObject.relatedField

      if (relatedField && !this.schemas[type].hasOwnProperty(relatedField))
        throw new this.errors.NotFoundError(`The field "${relatedField}" is ` +
          `non-existent on the type "${type}".`)

      return relatedField ? this.adapter.find(type, ids, {
        fields: { [relatedField]: true }
      }).then(records => {
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
          throw new this.errors.NotFoundError(
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

      if (payload instanceof Object)
        if (Object.keys(payload).length)
          context.response.payload =
            JSON.stringify(payload, function (key, value) {
              return Buffer.isBuffer(value) ?
                value.toString(options.bufferEncoding) : value
            }, options.spaces)
        else
          context.response.payload = undefined

      context.response.meta['content-type'] =
        context.request.serializerOutput + (this.options.extensions.length ?
          ` ext=${this.options.extensions.join(',')}` : '')

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


    // TODO Bulk create, stupid JSON API format
    parseCreate (context) {
      const { payload } = context.request

      return [payload[specKeys.primary]]
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

  JsonApiSerializer.id = 'application/vnd.api+json'

  return JsonApiSerializer
}

/*!
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapRecord (type, record) {
  const { keys, options, primaryKey } = this
  const prefix = options.hasOwnProperty('prefix') ?
      options.prefix : defaults.prefix
  const toString = id => id.toString()
  const id = record[primaryKey]

  delete record[primaryKey]

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
        ['underscore', 'dasherize'])] = value
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

    record[specKeys.links][field] = Object.assign({
      resource: prefix + this.uriTemplate.fillFromObject({
        type: this.options.inflect.type ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: field
      }),
      type: schemaField[keys.link]
    }, schemaField[keys.isArray] ?
      { ids: ids.map(toString) } : { id: ids.toString() })
  }

  return record
}


/*!
 * Internal function to determine the action based on the HTTP method,
 * there are edge cases in which PUT and PATCH can create records.
 */
function determineAction (context, request) {
  const handler = handlers[request.method]

  return typeof handler === 'function' ? handler(...arguments) : handler
}
