'use strict'

var map = require('../../../common/array/map')

var common = require('../common')
var generateId = common.generateId

var bufferEncoding = 'base64'


exports.inputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var typeKey = this.keys.type
  var isArrayKey = this.keys.isArray
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, field, fieldType, fieldIsArray, value

  // ID business.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    fieldType = fields[field][typeKey]
    fieldIsArray = fields[field][isArrayKey]

    if (!(field in record)) {
      result[field] = fieldIsArray ? [] : null
      continue
    }

    value = record[field]

    // Cast Buffer to String.
    if (fieldType === Buffer && value) {
      result[field] = fieldIsArray ?
        map(value, toString) : toString(value)
      continue
    }

    result[field] = value
  }

  return result
}


exports.outputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var typeKey = this.keys.type
  var isArrayKey = this.keys.isArray
  var denormalizedInverseKey = this.keys.denormalizedInverse
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, field, fieldType, fieldIsArray, fieldIsDenormalized, value

  // ID business.
  result[primaryKey] = record[primaryKey]

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    fieldIsArray = fields[field][isArrayKey]
    value = field in record ? record[field] : fieldIsArray ? [] : null
    fieldType = fields[field][typeKey]
    fieldIsDenormalized = fields[field][denormalizedInverseKey]

    // Cast String to Buffer.
    if (fieldType === Buffer && record[field]) {
      result[field] = fieldIsArray ? map(value, toBuffer) : toBuffer(value)
      continue
    }

    // Cast String to Date.
    if (fieldType === Date && record[field]) {
      result[field] = fieldIsArray ? map(value, toDate) : toDate(value)
      continue
    }

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value: value
      })
      continue
    }

    if (field in record) result[field] = value
  }

  return result
}


function toString (buffer) {
  return buffer.toString(bufferEncoding)
}


function toBuffer (string) {
  return new Buffer(string, bufferEncoding)
}


function toDate (string) {
  return new Date(Date.parse(string))
}
