'use strict'

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError


var castByType = [
  [ Number, function (x) { return parseFloat(x) } ],

  [ Date, function (x) {
    if (typeof x === 'string') {
      x = Date.parse(x)
      if (Number.isNaN(x)) throw new BadRequestError(
        'Date string must be an ISO 8601 formatted string.')
    }
    x = new Date(x)
    if (Number.isNaN(x.getTime())) throw new BadRequestError(
      'Date value is invalid.')
    return x
  } ],

  [ Buffer, function (x, options) {
    var bufferEncoding = options && options.bufferEncoding ?
      options.bufferEncoding : 'base64'

    if (typeof x !== 'string') throw new BadRequestError(
      'Buffer value must be a ' + bufferEncoding + '-encoded string.')

    return new Buffer(x, bufferEncoding)
  } ],

  [ Boolean, function (x) {
    if (typeof x === 'string') return x === 'true'
    return Boolean(x)
  } ],

  [ Object, function (x) {
    if (typeof x === 'string') return JSON.parse(x)
    if (typeof x === 'object') return x
    throw new BadRequestError('Could not cast "' + x + '" to JSON.')
  } ],

  [ String, function (x) { return '' + x } ]
]


/**
 * Cast a value to the given type. Skip if type is missing or value is null.
 *
 * @param {*} value
 * @param {Function} type - Constructor function.
 * @param {Object} [options]
 * @return {*}
 */
module.exports = function castValue (value, type, options) {
  var i, j, cast

  if (type)
    for (i = castByType.length; i--;) {
      j = castByType[i]
      if (j[0] === type) {
        cast = j[1]
        break
      }
    }

  return type && cast && value !== null ?
    cast(value, options) : value
}
