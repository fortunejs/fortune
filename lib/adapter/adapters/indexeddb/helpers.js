'use strict'

var map = require('../../../common/array/map')

var common = require('../common')
var generateId = common.generateId

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

    if (value)
      // Cast Buffer to base64 string.
      if (fieldType === Buffer) {
        result[field] = fieldIsArray ?
          map(value, toBase64) : toBase64(value)
        continue
      }
      // Cast Date to timestamp.
      else if (fieldType === Date) {
        result[field] = fieldIsArray ?
          map(value, toTimestamp) : toTimestamp(value)
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

    if (value)
      // Cast base64 string to Buffer.
      if (fieldType === Buffer) {
        result[field] = fieldIsArray ?
          map(value, toBuffer) : toBuffer(value)
        continue
      }
      // Cast timestamp to Date.
      else if (fieldType === Date) {
        result[field] = fieldIsArray ?
          map(value, toDate) : toDate(value)
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


// Buffer utils.
function toBase64 (buffer) { return buffer.toString('base64') }
function toBuffer (str) { return new Buffer(str, 'base64') }


// Date utils.
function toTimestamp (date) { return date.getTime() }
function toDate (timestamp) { return new Date(timestamp) }
