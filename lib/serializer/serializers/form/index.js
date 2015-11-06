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

  FormSerializer.prototype.processRequest = function () {
    throw new this.errors.UnsupportedError('Form input only.')
  }

  FormSerializer.prototype.parseCreate = function (context) {
    var Promise = promise.Promise
    var request = context.request
    var meta = request.meta
    var payload = request.payload
    var type = request.type
    var recordTypes = this.recordTypes
    var options = this.options
    var castValue = this.castValue
    var isArrayKey = this.keys.isArray
    var typeKey = this.keys.type
    var fields = recordTypes[type]
    var busboy = new Busboy({ headers: meta })
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
        value = castValue(value, fieldType, options)

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

    return this.parseCreate(context)

    .then(function (records) {
      return map(records, function (record) {
        var id = (function (id) {
          // Stolen from jQuery source code:
          // https://api.jquery.com/jQuery.isNumeric/
          var float = Number.parseFloat(id)
          return id - float + 1 >= 0 ? float : id
        }(record[primaryKey]))

        if (!id) throw new BadRequestError('ID is missing.')
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
