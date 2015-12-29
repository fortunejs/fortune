'use strict'

var Busboy = require('busboy')
var stream = require('stream')
var promise = require('../../../common/promise')
var assign = require('../../../common/assign')
var map = require('../../../common/array/map')
var constants = require('../../../common/constants')
var internalKey = constants.internal


function inherit (Serializer) {
  function FormSerializer (properties) {
    Serializer.call(this, properties)
  }

  Object.defineProperty(FormSerializer, internalKey, { value: true })

  FormSerializer.prototype = Object.create(Serializer.prototype)

  FormSerializer.prototype.processRequest = function (context) {
    throw new this.errors.UnsupportedError(
      this.message('InputOnly', context.request.meta.language))
  }

  FormSerializer.prototype.parseCreate = function (context) {
    var Promise = promise.Promise
    var request = context.request
    var headers = request.meta.headers
    var payload = request.payload
    var type = request.type
    var recordTypes = this.recordTypes
    var opts = { language: context.request.meta.language }
    var options = this.options
    var castValue = this.castValue
    var isArrayKey = this.keys.isArray
    var typeKey = this.keys.type
    var fields = recordTypes[type]
    var busboy = new Busboy({ headers: headers })
    var bufferStream = new stream.PassThrough()
    var record = {}

    return new Promise(function (resolve) {
      busboy.on('file', function (field, file, filename) {
        var fieldDefinition = fields[field] || {}
        var fieldIsArray = fieldDefinition[isArrayKey]
        var chunks = []

        if (fieldIsArray && !(field in record))
          record[field] = []

        file.on('data', function (chunk) { chunks[chunks.length] = chunk })
        file.on('end', function () {
          var data = Buffer.concat(chunks)
          data.filename = filename

          if (fieldIsArray) {
            record[field][record[field].length] = data
            return null
          }

          if (field in record) {
            if (Array.isArray(record[field]))
              record[field][record[field].length] = data
            else record[field] = [ record[field], data ]
            return null
          }

          record[field] = data
        })
      })

      busboy.on('field', function (field, value) {
        var fieldDefinition = fields[field] || {}
        var fieldType = fieldDefinition[typeKey]
        var fieldIsArray = fieldDefinition[isArrayKey]
        value = castValue(value, fieldType, assign(opts, options))

        if (fieldIsArray) {
          if (!(field in record)) record[field] = []
          record[field][record[field].length] = value
          return null
        }

        if (field in record) {
          if (Array.isArray(record[field]))
            record[field][record[field].length] = value
          else record[field] = [ record[field], value ]
          return null
        }

        record[field] = value
      })

      busboy.on('finish', function () { resolve([ record ]) })

      bufferStream.end(payload)
      bufferStream.pipe(busboy)
    })
  }

  FormSerializer.prototype.parseUpdate = function (context) {
    var BadRequestError = this.errors.BadRequestError
    var primaryKey = this.keys.primary
    var message = this.message
    var language = context.request.meta.language

    return this.parseCreate(context)

    .then(function (records) {
      return map(records, function (record) {
        var id = record[primaryKey]
        var float = Number.parseFloat(id)
        // Stolen from jQuery source code:
        // https://api.jquery.com/jQuery.isNumeric/
        id = id - float + 1 >= 0 ? float : id

        if (!id) throw new BadRequestError(message('MissingID', language))
        delete record[primaryKey]

        return {
          id: id,
          replace: record
        }
      })
    })
  }

  return FormSerializer
}


exports.formUrlEncoded = function (Serializer) {
  return assign(inherit(Serializer),
    { id: 'application/x-www-form-urlencoded' })
}


exports.formData = function (Serializer) {
  return assign(inherit(Serializer),
    { id: 'multipart/form-data' })
}
