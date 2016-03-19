'use strict'

var url = require('url')
var assign = require('../common/assign')
var map = require('../common/array/map')
var reduce = require('../common/array/reduce')

var inBrackets = /\[([^\]]+)\]/
var isMatch = /^match/
var isRange = /^range/
var isExists = /^exists/


module.exports = function (HttpSerializer) {
  /**
   * This is an ad hoc JSON-over-HTTP serializer, which is suitable only for
   * prototyping or internal use.
   */
  function JsonSerializer (properties) {
    HttpSerializer.call(this, properties)

    Object.defineProperties(this, {
      methodMap: {
        value: {
          'GET': this.methods.find,
          'POST': this.methods.create,
          'PATCH': this.methods.update,
          'DELETE': this.methods.delete
        }
      }
    })
  }

  JsonSerializer.prototype = Object.create(HttpSerializer.prototype)

  JsonSerializer.prototype.processRequest =
  function (contextRequest, request, response) {
    var message = this.message
    var methods = this.methods
    var recordTypes = this.recordTypes
    var methodMap = this.methodMap
    var castValue = this.castValue
    var NotFoundError = this.errors.NotFoundError
    var typeKey = this.keys.type
    var language = contextRequest.meta.language
    var opts = { language: language }
    var parsedUrl, pathname, query, parts, fields, options
    var parameter, field, fieldType, value, output

    request.meta = {}
    parsedUrl = url.parse(request.url, true)
    pathname = parsedUrl.pathname
    query = parsedUrl.query
    parts = pathname.slice(1).split('/')

    if (parts.length > 2)
      throw new NotFoundError(message('InvalidURL', language))

    contextRequest.method = request.meta.method = methodMap[request.method]
    contextRequest.type = decodeURIComponent(parts[0]) || null
    contextRequest.ids = parts[1] ?
      map(decodeURIComponent(parts[1]).split(','), function (id) {
        // Stolen from jQuery source code:
        // https://api.jquery.com/jQuery.isNumeric/
        var float = Number.parseFloat(id)
        return id - float + 1 >= 0 ? float : id
      }) : null

    // Bypass the request to show index.
    if (contextRequest.method === methods.find &&
      contextRequest.type === null && contextRequest.ids === null) {
      output = {
        payload: {
          recordTypes: Object.keys(recordTypes)
        }
      }
      response.statusCode = 200
      throw output
    }

    fields = recordTypes[contextRequest.type]
    options = {}

    // Attach include option.
    if ('include' in query)
      contextRequest.include = map(query.include.split(','),
        function (x) { return x.split('.') })

    // Set default limit to 1000.
    options.limit = 'limit' in query ?
      parseInt(query.limit, 10) : 1000
    options.offset = 'offset' in query ?
      parseInt(query.offset, 10) : 0

    // Attach fields option.
    if ('fields' in query)
      options.fields = reduce(query.fields.split(','),
        function (fields, field) {
          fields[field] = true
          return fields
        }, {})

    for (parameter in query) {
      // Attach match option.
      if (parameter.match(isMatch)) {
        if (!options.match) options.match = {}
        field = (parameter.match(inBrackets) || [])[1]
        fieldType = fields[field][typeKey]
        value = query[parameter]

        options.match[field] = Array.isArray(value) ? map(value,
          curryCast(castValue, fieldType, assign(opts, this.options))) :
          castValue(value, fieldType, assign(opts, this.options))
      }

      // Attach range option.
      if (parameter.match(isRange)) {
        if (!options.range) options.range = {}
        field = (parameter.match(inBrackets) || [])[1]
        fieldType = fields[field][typeKey]
        value = query[parameter]

        if (!Array.isArray(value)) value = [ value ]

        options.range[field] = map(value,
          curryCast(castValue, fieldType, assign(opts, this.options)))
      }

      // Attach exists option.
      if (parameter.match(isExists)) {
        if (!options.exists) options.exists = {}
        field = (parameter.match(inBrackets) || [])[1]
        value = query[parameter] !== '0' && query[parameter] !== 'false'
        options.exists[field] = value
      }
    }

    // Attach sort option.
    if ('sort' in query)
      options.sort = reduce(query.sort.split(','),
        function (sort, field) {
          if (field.charAt(0) === '-') sort[field.slice(1)] = false
          else sort[field] = true

          return sort
        }, {})

    contextRequest.options = options

    return contextRequest
  }


  JsonSerializer.prototype.processResponse =
  function (contextResponse, request, response) {
    var jsonSpaces = this.options.jsonSpaces || 2
    var bufferEncoding = this.options.bufferEncoding || 'base64'
    var payload = contextResponse.payload
    var meta = contextResponse.meta || {}
    var method = request.meta.method
    var updateModified = meta.updateModified
    var methods = this.methods

    // Delete and update requests may not respond with anything.
    if (method === methods.delete ||
      (method === methods.update && !updateModified)) {
      delete contextResponse.payload
      return contextResponse
    }

    // Set the charset to UTF-8.
    response.setHeader('Content-Type',
      JsonSerializer.mediaType + '; charset=utf-8')

    if (payload != null)
      contextResponse.payload = JSON.stringify(payload,
        function (key, value) {
          // Duck type checking for buffer stringification.
          if (value && value.type === 'Buffer' &&
            Array.isArray(value.data) &&
            Object.keys(value).length === 2)
            return new Buffer(value.data).toString(bufferEncoding)

          return value
        }, jsonSpaces)

    else if (contextResponse instanceof Error)
      contextResponse.payload = JSON.stringify({
        name: contextResponse.name,
        message: contextResponse.message
      }, null, jsonSpaces)

    return contextResponse
  }


  JsonSerializer.prototype.parsePayload = function (contextRequest) {
    var method = contextRequest.method
    var methods = this.methods

    if (method === methods.create) return this.parseCreate(contextRequest)
    else if (method === methods.update) return this.parseUpdate(contextRequest)

    throw new Error('Invalid method.')
  }


  JsonSerializer.prototype.parseCreate = function (contextRequest) {
    var opts = { language: contextRequest.meta.language }
    var options = this.options
    var recordTypes = this.recordTypes
    var castValue = this.castValue
    var typeKey = this.keys.type
    var type = contextRequest.type
    var fields = recordTypes[type]
    var i, j, records, record, field, value, fieldDefinition, fieldType

    records = parseBuffer.call(this, contextRequest.payload)
    if (!Array.isArray(records)) records = [ records ]

    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      for (field in record) {
        value = record[field]
        fieldDefinition = fields[field] || {}
        fieldType = fieldDefinition[typeKey]

        record[field] = Array.isArray(value) ?
          map(value, curryCast(castValue, fieldType, assign(opts, options))) :
          castValue(value, fieldType, assign(opts, options))
      }
    }

    return records
  }


  JsonSerializer.prototype.parseUpdate = function (contextRequest) {
    var i, update, updates

    updates = parseBuffer.call(this, contextRequest.payload)
    if (!Array.isArray(updates)) updates = [ updates ]

    for (i = updates.length; i--;) {
      update = updates[i]
      castFields.call(this, contextRequest,
        update.replace, update.push, update.pull)
    }

    return updates
  }

  JsonSerializer.mediaType = 'application/json'

  return JsonSerializer
}


function parseBuffer (payload) {
  var BadRequestError = this.errors.BadRequestError

  if (!Buffer.isBuffer(payload)) return null

  try {
    return JSON.parse(payload.toString())
  }
  catch (error) {
    throw new BadRequestError(error.message)
  }
}


function curryCast (fn, type, options) {
  return function (value) {
    return fn(value, type, options)
  }
}


function castFields (contextRequest) {
  var opts = { language: contextRequest.meta.language }
  var options = this.options
  var castValue = this.castValue
  var typeKey = this.keys.type
  var fields = this.recordTypes[contextRequest.type]
  var i, j, object, field, value, fieldDefinition, fieldType

  for (i = 1, j = arguments.length; i < j; i++) {
    object = arguments[i]
    for (field in object) {
      value = object[field]
      fieldDefinition = fields[field] || {}
      fieldType = fieldDefinition[typeKey]

      object[field] = Array.isArray(value) ?
        map(value, curryCast(castValue, fieldType, assign(opts, options))) :
        castValue(value, fieldType, assign(opts, options))
    }
  }
}
