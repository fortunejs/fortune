'use strict'

var map = require('../../../common/array/map')

var common = require('../common')
var generateId = common.generateId

var arrayBuffer = require('array-buffer')
var toArrayBuffer = arrayBuffer.toArrayBuffer
var toBuffer = arrayBuffer.toBuffer

// This is for ensuring that type/ID combination is unique.
// https://stackoverflow.com/questions/26019147
var delimiter = '__'


// Unfortunately, IndexedDB implementations are pretty buggy. This adapter
// tries to work around the incomplete and buggy implementations of IE10+ and
// iOS 8+.
// http://www.raymondcamden.com/2014/09/25/IndexedDB-on-iOS-8-Broken-Bad


exports.delimiter = delimiter


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
  result[primaryKey] = type + delimiter + (primaryKey in record ?
    record[primaryKey] : generateId())

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    fieldType = fields[field][typeKey]
    fieldIsArray = fields[field][isArrayKey]

    if (!(field in record)) {
      result[field] = fieldIsArray ? [] : null
      continue
    }

    value = record[field]

    // Cast Buffer to ArrayBuffer.
    if (fieldType === Buffer && value) {
      result[field] = fieldIsArray ?
        map(value, toArrayBuffer) : toArrayBuffer(value)
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
  var id = record[primaryKey].split(delimiter)[1]
  var float = Number.parseFloat(id)
  result[primaryKey] = id - float + 1 >= 0 ? float : id

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    fieldIsArray = fields[field][isArrayKey]
    value = field in record ? record[field] : fieldIsArray ? [] : null
    fieldType = fields[field][typeKey]
    fieldIsDenormalized = fields[field][denormalizedInverseKey]

    // Cast ArrayBuffer to Buffer.
    if (fieldType === Buffer && record[field]) {
      result[field] = fieldIsArray ?
        map(value, toBuffer) : toBuffer(value)
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
