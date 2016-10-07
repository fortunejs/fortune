'use strict'

var Busboy = require('busboy')
var stream = require('stream')
var promise = require('../common/promise')
var assign = require('../common/assign')
var castToNumber = require('../common/cast_to_number')
var initializeContext = require('./http_initialize_context')
var attachQueries = initializeContext.attachQueries


function inherit (HttpSerializer) {
  function FormSerializer (properties) {
    HttpSerializer.call(this, properties)
  }

  FormSerializer.prototype = Object.create(HttpSerializer.prototype)


  FormSerializer.prototype.processRequest = function (contextRequest) {
    throw new this.errors.UnsupportedError(
      this.message('InputOnly', contextRequest.meta.language))
  }


  FormSerializer.prototype.parsePayload = function (contextRequest, request) {
    var self = this
    var BadRequestError = this.errors.BadRequestError
    var primaryKey = this.keys.primary
    var message = this.message
    var methods = this.methods
    var language = contextRequest.meta.language

    return this.parse(contextRequest)

    .then(function (records) {
      var record = records[0]
      var method = contextRequest.method
      var id

      if ('method' in record) {
        method = contextRequest.method = request.meta.method = record.method
        delete record.method
      }

      if (method === methods.find)
        attachQueries.call(self, contextRequest, records[0])

      else if (method === methods.create) return records

      else if (method === methods.update) {
        id = castToNumber(contextRequest.ids ?
          contextRequest.ids[0] : record[primaryKey])

        if (!id) throw new BadRequestError(message('MissingID', language))
        delete record[primaryKey]

        return [
          {
            id: id,
            replace: record
          }
        ]
      }

      // Return nothing for find and delete method.
      return null
    })
  }


  FormSerializer.prototype.parse = function (contextRequest) {
    var BadRequestError = this.errors.BadRequestError
    var message = this.message
    var language = contextRequest.meta.language
    var Promise = promise.Promise
    var headers = contextRequest.meta.headers
    var payload = contextRequest.payload
    var type = contextRequest.type
    var recordTypes = this.recordTypes
    var opts = { language: contextRequest.meta.language }
    var options = this.options
    var castValue = this.castValue
    var isArrayKey = this.keys.isArray
    var typeKey = this.keys.type
    var fields = recordTypes[type]
    var busboy = new Busboy({ headers: headers })
    var bufferStream = new stream.PassThrough()
    var record = {}

    return new Promise(function (resolve, reject) {
      busboy.on('file', function (field, file, filename) {
        var fieldDefinition = fields[field] || {}
        var fieldIsArray = fieldDefinition[isArrayKey]
        var chunks = []

        if (fieldIsArray && !record.hasOwnProperty(field)) record[field] = []

        file.on('data', function (chunk) { chunks.push(chunk) })
        file.on('end', function () {
          var data = Buffer.concat(chunks)

          if (!data.length) return
          data.filename = filename

          if (fieldIsArray) {
            record[field].push(data)
            return
          }

          if (record.hasOwnProperty(field)) {
            reject(new BadRequestError(
              message('EnforceSingular', language, { key: field })))
            return
          }

          record[field] = data
        })
      })

      busboy.on('field', function (field, value) {
        var fieldDefinition = fields[field] || {}
        var fieldType = fieldDefinition[typeKey]
        var fieldIsArray = fieldDefinition[isArrayKey]

        if (fieldIsArray && !record.hasOwnProperty(field)) record[field] = []

        try {
          value = castValue(value, fieldType, assign(opts, options))
        }
        catch (error) {
          reject(error)
          return
        }

        if (fieldIsArray) {
          if (value != null) record[field].push(value)
          return
        }

        if (record.hasOwnProperty(field)) {
          reject(new BadRequestError(
            message('EnforceSingular', language, { key: field })))
          return
        }

        record[field] = value
      })

      busboy.on('finish', function () { resolve([ record ]) })

      bufferStream.end(payload)
      bufferStream.pipe(busboy)
    })
  }


  return FormSerializer
}


exports.formUrlEncoded = function (Serializer) {
  return assign(inherit(Serializer),
    { mediaType: 'application/x-www-form-urlencoded' })
}


exports.formData = function (Serializer) {
  return assign(inherit(Serializer),
    { mediaType: 'multipart/form-data' })
}
