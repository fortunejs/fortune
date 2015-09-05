import url from 'url'
import DefaultSerializer from '../../default'


const inBrackets = /\[([^\]]+)\]/
const isMatch = /^match/


export default () => Object.assign(

/**
 * This is an ad hoc JSON-over-HTTP serializer, it is missing some features
 * since it tries to limit itself to JSON-serializable objects and does not try
 * to include any special keys in the payload. Notably, the `include` option is
 * missing.
 */
class JsonSerializer extends DefaultSerializer {

  constructor () {
    super(...arguments)

    const { methods: {
      find: findMethod,
      create: createMethod,
      update: updateMethod,
      delete: deleteMethod
    } } = this

    const methodMap = {
      'GET': findMethod,
      'POST': createMethod,
      'PATCH': updateMethod,
      'DELETE': deleteMethod
    }

    Object.defineProperties(this, {
      methodMap: { value: methodMap }
    })
  }

  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1) return context

    const { recordTypes, methodMap, castValue,
      errors: { NotFoundError }, keys: { type: typeKey } } = this

    const request = arguments[1]
    const { pathname, query } = url.parse(request.url, true)
    const parts = pathname.slice(1).split('/')

    if (parts.length > 2) throw new NotFoundError(`Invalid path.`)

    context.request.method = methodMap[
      request.headers['x-http-method-override'] ||
      request.headers['x-method-override'] ||
      request.headers['x-http-method'] ||
      request.method]
    context.request.type = decodeURIComponent(parts[0]) || null
    context.request.ids = parts[1] ?
      decodeURIComponent(parts[1]).split(',').map(id => {
        // Stolen from jQuery source code:
        // https://api.jquery.com/jQuery.isNumeric/
        const float = Number.parseFloat(id)
        return id - float + 1 >= 0 ? float : id
      }) : null

    const fields = recordTypes[context.request.type]
    const { request: { options } } = context

    options.limit = 'limit' in query ?
      parseInt(query.limit, 10) : 1000
    options.offset = 'offset' in query ?
      parseInt(query.offset, 10) : 0

    if ('fields' in query)
      options.fields = query.fields.split(',').reduce((fields, field) => {
        fields[field] = true
        return fields
      }, {})

    // Attach match option.
    for (let parameter of Object.keys(query))
      if (parameter.match(isMatch)) {
        if (!options.match) options.match = {}
        const field = (parameter.match(inBrackets) || [])[1]
        const fieldType = fields[field][typeKey]
        const value = query[parameter]

        options.match[field] = Array.isArray(value) ?
          value.map(castMap.bind(null, fieldType, options)) :
          castValue(value, fieldType, options)
      }

    if ('sort' in query)
      options.sort = query.sort.split(',').reduce((sort, field) => {
        const firstChar = field.charAt(0)

        if (firstChar === '-') sort[field.slice(1)] = false
        else sort[field] = true

        return sort
      }, {})

    return context
  }


  processResponse (context, request, response) {
    if (arguments.length === 1) return context

    // Set the charset to UTF-8.
    response.setHeader('Content-Type', `${JsonSerializer.id}; charset=utf-8`)

    return context
  }


  showResponse (context) {
    const { methods: { update: updateMethod, delete: deleteMethod } } = this
    const { request: { method }, response: { updateModified } } = context

    // Delete and update requests may not respond with anything.
    if (method === deleteMethod ||
    (method === updateMethod && !updateModified))
      return context

    return super.showResponse(...arguments)
  }


  parseCreate (context) {
    context.request.payload = parseBuffer.call(this, context.request.payload)

    const records = super.parseCreate(context)
    const { options, recordTypes, castValue,
      keys: { type: typeKey } } = this

    const { request: { type } } = context
    const fields = recordTypes[type]
    const cast = (type, options) => value => castValue(value, type, options)

    for (let record of records)
      for (let field in record) {
        const value = record[field]
        const fieldDefinition = fields[field] || {}
        const fieldType = fieldDefinition[typeKey]

        record[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue(value, fieldType, options)
      }

    return records
  }


  parseUpdate (context) {
    context.request.payload = parseBuffer.call(this, context.request.payload)

    const updates = super.parseUpdate(context)
    const { options, recordTypes, castValue,
      keys: { type: typeKey } } = this
    const { request: { type } } = context
    const fields = recordTypes[type]
    const cast = (type, options) => value => castValue(value, type, options)

    for (let update of updates)
      castFields(update.replace, update.push, update.pull)

    return updates

    function castFields () {
      for (let object of arguments)
        for (let field in object) {
          const value = object[field]
          const fieldDefinition = fields[field] || {}
          const fieldType = fieldDefinition[typeKey]

          object[field] = Array.isArray(value) ?
            value.map(cast(fieldType, options)) :
            castValue(value, fieldType, options)
        }
    }
  }

}, { id: 'application/json' })


function parseBuffer (payload) {
  const { errors: { BadRequestError } } = this

  if (!Buffer.isBuffer(payload)) return null

  try {
    return JSON.parse(payload.toString())
  }
  catch (error) {
    throw new BadRequestError(`Invalid JSON: ${error.message}`)
  }
}
