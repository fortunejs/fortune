import url from 'url'
import DefaultSerializer from '../../default'
import { castString, castValue } from '../common'


const mediaType = 'application/json'
const inBrackets = /\[([^\]]+)\]/
const isMatch = /^match/


// This ad-hoc JSON-over-HTTP serializer is missing some features since it
// tries to limit itself to JSON-serializable objects. Notably, the `include`
// option is missing.
export default () => Object.assign(
class AdHocSerializer extends DefaultSerializer {

  constructor () {
    super(...arguments)

    const { methods } = this

    const methodMap = {
      'GET': methods.find,
      'POST': methods.create,
      'PATCH': methods.update,
      'DELETE': methods.delete
    }

    Object.defineProperties(this, {
      methodMap: { value: methodMap }
    })
  }

  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1) return context

    const { recordTypes, keys, methodMap, errors: { NotFoundError } } = this

    const request = arguments[1]
    const { pathname, query } = url.parse(request.url, true)
    const parts = pathname.slice(1).split('/')

    if (parts.length > 2) throw new NotFoundError(`Invalid path.`)

    if (Buffer.isBuffer(context.request.payload))
      context.request.payload = JSON.parse(context.request.payload.toString())

    context.request.method = methodMap[request.method]
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
        let value = query[parameter]
        if (field in fields && castString.has(fields[field][keys.type]))
          value = castString.get(fields[field][keys.type])(value, options)
        options.match[field] = value
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


  showResponse (context) {
    const { methods } = this
    const { request: { method }, response: { updateModified } } = context

    // Delete and update requests may not respond with anything.
    if (method === methods.delete ||
    (method === methods.update && !updateModified))
      return context

    return super.showResponse(...arguments)
  }


  parseCreate (context) {
    const records = super.parseCreate(context)

    if (!records.length) throw new BadRequestError(`Payload is empty.`)

    const { errors: { BadRequestError }, recordTypes, keys, options } = this
    const { request: { type } } = context
    const fields = recordTypes[type]

    for (let record of records)
      for (let field in record)
        record[field] = castValue.call(this, record[field], field in fields ?
          fields[field][keys.type] : null, options)

    return records
  }


  parseUpdate (context) {
    const updates = super.parseUpdate(context)
    const { keys, options, recordTypes,
      errors: { BadRequestError } } = this
    const { request: { type } } = context
    const fields = recordTypes[type]
    const cast = (type, options) => value =>
      castValue.call(this, value, type, options)

    if (!updates.length) throw new BadRequestError(`Payload is empty.`)

    return updates.map(update => {
      for (let field in update.replace) {
        const fieldDefinition = fields[field]
        const value = update.replace[field]
        const fieldType = fieldDefinition ?
          fieldDefinition[keys.type] : null

        update.replace[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue.call(this, value, fieldType, options)
      }

      for (let field in update.push) {
        const fieldDefinition = fields[field]
        const value = update.push[field]
        const fieldType = fieldDefinition ?
          fieldDefinition[keys.type] : null

        update.push[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue.call(this, value, fieldType, options)
      }

      for (let field in update.pull) {
        const fieldDefinition = fields[field]
        const value = update.pull[field]
        const fieldType = fieldDefinition ?
          fieldDefinition[keys.type] : null

        update.pull[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue.call(this, value, fieldType, options)
      }

      return update
    })
  }

}, { id: mediaType })
