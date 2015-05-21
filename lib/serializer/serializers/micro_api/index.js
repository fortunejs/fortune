import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { processData, methodMap } from '../../../net/http'


const mediaType = 'application/vnd.micro+json'

// Reserved keys from the Micro API specification.
const reservedKeys = {
  array: '@array',
  error: '@error',
  href: '@href',
  id: '@id',
  inverse: '@inverse',
  links: '@links',
  meta: '@meta',
  operate: '@operate',
  type: '@type'
}

const defaults = {

  // Inflect the record type name in the URL.
  inflectType: true,

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

  // Queries to support.
  queries: new Set([
    'include', 'limit', 'offset', 'match', 'sort', 'field'
  ]),

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField}{?query*}'

}

const inBrackets = /\[([^\]]+)\]/
const isField = /^field/
const isMatch = /^match/


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


function attachQueries (context, query, options) {
  const { request } = context
  const { queries, includeDepth, pageLimit } = options

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
    if (parameter.match(isMatch)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = query[parameter]
    }

  })

  // Attach sort option.
  if (queries.has('sort') && query.sort) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [sort]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      sort[field.slice(1)] = firstChar === '+' ? 1 : -1

      return sort
    }, {})
  }

  // Attach include option.
  if (queries.has('include') && query.include)
    request.include = query.include
      .split(',').map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach offset option.
  if (queries.has('offset') && query.offset)
    request.options.offset =
      Math.abs(parseInt(query.offset, 10))

  // Attach default limit.
  if (queries.has('limit') && query.limit) {
    const limit = Math.abs(parseInt(query.limit, 10))
    request.options.limit =
      limit > pageLimit ? pageLimit : limit
  }
  else request.options.limit = pageLimit
}
