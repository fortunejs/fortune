'use strict'

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
  [ String, value => typeof value === 'string' ],
  [ Number, value => typeof value === 'number' ],
  [ Boolean, value => typeof value === 'boolean' ],
  [ Date, value => value instanceof Date && !Number.isNaN(value.valueOf()) ],
  [ Object, value => value !== null && typeof value === 'object' ],
  [ Buffer, value => Buffer.isBuffer(value) ]
]


/**
 * Throw errors for mismatched types on a record.
 *
 * @param {String} type
 * @param {Object} record
 * @param {Object} fields
 * @return {Object}
 */
module.exports = function enforce (type, record, fields) {
  var keys = Object.keys(record)
  var i, j, key, value, item, fieldDefinition

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
          throw new BadRequestError('The value of "' + key + '" is ' +
            'invalid, it must be an array with values of type ' +
            fieldDefinition[typeKey].name.toLowerCase() + '.')

        for (j = value.length; j--;) {
          item = value[j]
          checkValue(fieldDefinition, key, item)
        }
      }
      else checkValue(fieldDefinition, key, value)

      continue
    }

    if (fieldDefinition[linkKey]) {
      if (fieldDefinition[isArrayKey]) {
        if (!Array.isArray(value))
          throw new BadRequestError('The value of "' + key + '" is ' +
            'invalid, it must be an array.')

        if (type === fieldDefinition[linkKey] &&
          find(value, matchId(record[primaryKey])))
          throw new BadRequestError('An ID of "' + key + '" is ' +
            'invalid, it cannot be the ID of the record.')

        continue
      }

      if (Array.isArray(value))
        throw new BadRequestError('The value of "' + key + '" is ' +
          'invalid, it must be a singular value.')

      if (type === fieldDefinition[linkKey] && record[primaryKey] === value)
        throw new BadRequestError('The ID of "' + key + '" is ' +
          'invalid, it cannot be the ID of the record.')

      continue
    }
  }

  return record
}


function checkValue (field, key, value) {
  // If the field type is a symbol, then there is nothing to enforce.
  if (typeof field[typeKey] === 'symbol') return

  // Fields may be nullable, but if they're defined, then they must be defined
  // properly.
  if (value !== null && !find(checkInput, function (pair) {
    return pair[0] === field[typeKey]
  })[1](value))
    throw new BadRequestError(field[isArrayKey] ?
      'A value in the array of "' + key + '" is invalid, it must be a ' +
      field[typeKey].name.toLowerCase() + '.' :
      'The value of "' + key + '" is invalid, it must be a ' +
      field[typeKey].name.toLowerCase() + '.')
}


function matchId (a) {
  return function (b) {
    return a === b
  }
}
