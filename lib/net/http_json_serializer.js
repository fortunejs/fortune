'use strict'

var assign = require('../common/assign')
var map = require('../common/array/map')

var buffer = Buffer.from || Buffer


module.exports = function (HttpSerializer) {
  /**
   * This is an ad hoc JSON-over-HTTP serializer, which is suitable only for
   * prototyping or internal use.
   */
  function JsonSerializer (properties) {
    HttpSerializer.call(this, properties)
  }

  JsonSerializer.prototype = Object.create(HttpSerializer.prototype)


  JsonSerializer.prototype.processResponse =
  function (contextResponse, request, response) {
    var jsonSpaces = this.options.jsonSpaces || 2
    var bufferEncoding = this.options.bufferEncoding || 'base64'
    var payload = contextResponse.payload
    var meta = contextResponse.meta || {}
    var method = request.meta.method
    var updateModified = meta.updateModified
    var methods = this.methods
    var recordTypes = this.recordTypes
    var output

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
            return buffer(value.data).toString(bufferEncoding)

          return value
        }, jsonSpaces)

    else if (contextResponse instanceof Error) {
      // Skip setting payload if method is invalid.
      if (contextResponse.isMethodInvalid)
        return contextResponse

      // If the error is type unspecified, show the index.
      if (contextResponse.isTypeUnspecified) {
        output = { recordTypes: Object.keys(recordTypes) }
        response.statusCode = 200
      }

      else output = {
        name: contextResponse.name,
        message: contextResponse.message
      }

      contextResponse.payload = JSON.stringify(output, null, jsonSpaces)
    }

    return contextResponse
  }


  JsonSerializer.prototype.parsePayload = function (contextRequest) {
    var method = contextRequest.method
    var language = contextRequest.meta.language
    var message = this.message
    var methods = this.methods
    var MethodError = this.errors.MethodError

    if (method === methods.create) return this.parseCreate(contextRequest)
    else if (method === methods.update) return this.parseUpdate(contextRequest)

    throw new MethodError(message(
      'InvalidMethod', language, { method: method }))
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
    var update, updates
    var i, j

    updates = parseBuffer.call(this, contextRequest.payload)
    if (!Array.isArray(updates)) updates = [ updates ]

    for (i = 0, j = updates.length; i < j; i++) {
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
