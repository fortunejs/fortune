'use strict'

var message = require('../common/message')
var find = require('../common/array/find')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var linkKey = keys.link
var isArrayKey = keys.isArray


// Check input values.
var checkInput = [
  [ String, function (value) {
    return typeof value === 'string'
  } ],
  [ Number, function (value) {
    return typeof value === 'number'
  } ],
  [ Boolean, function (value) {
    return typeof value === 'boolean'
  } ],
  [ Date, function (value) {
    return value instanceof Date && !Number.isNaN(value.valueOf())
  } ],
  [ Object, function (value) {
    return value !== null && typeof value === 'object'
  } ],
  [ Buffer, function (value) {
    return Buffer.isBuffer(value)
  } ]
]


/**
 * Throw errors for mismatched types on a record.
 *
 * @param {String} type
 * @param {Object} record
 * @param {Object} fields
 * @param {Object} meta
 * @return {Object}
 */
module.exports = function enforce (type, record, fields, meta) {
  var keys = Object.keys(record)
  var i, j, key, value, item, fieldDefinition, language

  if (!meta) meta = {}
  language = meta.language

  for (i = keys.length; i--;) {
    key = keys[i]
    fieldDefinition = fields[key]

    if (!fieldDefinition) {
      if (key !== primaryKey) delete record[key]
      continue
    }

    value = record[key]

    if (fieldDefinition[typeKey]) {
      if (fieldDefinition[isArrayKey]) {
        // If the field is defined as an array but the value is not,
        // then throw an error.
        if (!Array.isArray(value))
          throw new BadRequestError(message('EnforceArrayType', language, {
            key: key, type: fieldDefinition[typeKey].name
          }))

        for (j = value.length; j--;) {
          item = value[j]
          checkValue(fieldDefinition, key, item, meta)
        }
      }
      else checkValue(fieldDefinition, key, value, meta)

      continue
    }

    if (fieldDefinition[linkKey]) {
      if (fieldDefinition[isArrayKey]) {
        if (!Array.isArray(value))
          throw new BadRequestError(
            message('EnforceArray', language, { key: key }))

        if (type === fieldDefinition[linkKey] &&
          find(value, matchId(record[primaryKey])))
          throw new BadRequestError(
            message('EnforceSameID', language, { key: key }))

        continue
      }

      if (Array.isArray(value))
        throw new BadRequestError(
          message('EnforceSingular', language, { key: key }))

      if (type === fieldDefinition[linkKey] && record[primaryKey] === value)
        throw new BadRequestError(
          message('EnforceSameID', language, { key: key }))

      continue
    }
  }

  return record
}


function checkValue (field, key, value, meta) {
  var language = meta.language
  var check

  // Skip `null` case.
  if (value === null) return null

  check = find(checkInput, function (pair) {
    return pair[0] === field[typeKey]
  })
  if (check) check = check[1]
  else check = field[typeKey]

  // Fields may be nullable, but if they're defined, then they must be defined
  // properly.
  if (!check(value)) throw new BadRequestError(
    message(field[isArrayKey] ? 'EnforceValueArray' : 'EnforceValue',
    language, { key: key, type: field[typeKey].name }))
}


function matchId (a) {
  return function (b) {
    return a === b
  }
}
