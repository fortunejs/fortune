'use strict'

var common = require('../common')
var generateId = common.generateId


exports.inputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, j, field

  // Ensure that ID exists on the record.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (i = 0, j = fieldsArray.length; i < j; i++) {
    field = fieldsArray[i]
    if (!record.hasOwnProperty(field)) {
      result[field] = fields[field][isArrayKey] ? [] : null
      continue
    }

    result[field] = record[field]
  }

  return result
}


exports.outputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var denormalizedInverseKey = this.keys.denormalizedInverse
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, j, field, hasField, value

  // Ensure that ID exists on the record.
  result[primaryKey] = record[primaryKey]

  for (i = 0, j = fieldsArray.length; i < j; i++) {
    field = fieldsArray[i]
    hasField = record.hasOwnProperty(field)
    value = hasField ? record[field] :
      fields[field][isArrayKey] ? [] : null

    // Do not enumerate denormalized fields.
    if (fields[field][denormalizedInverseKey]) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value: value
      })
      continue
    }

    if (hasField) result[field] = value
  }

  return result
}
