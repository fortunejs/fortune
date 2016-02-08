'use strict'

var errors = require('../common/errors')
var message = require('../common/message')
var BadRequestError = errors.BadRequestError


var castByType = [
  [ Number, function (x) { return parseFloat(x) } ],

  [ Date, function (x, options) {
    if (typeof x === 'string') {
      x = Date.parse(x)
      if (Number.isNaN(x)) throw new BadRequestError(
        message('DateISO8601', options.language))
    }

    x = new Date(x)
    if (Number.isNaN(x.getTime())) throw new BadRequestError(
      message('DateInvalid', options.language))

    return x
  } ],

  [ Buffer, function (x, options) {
    var bufferEncoding = options && options.bufferEncoding ?
      options.bufferEncoding : 'base64'

    if (typeof x !== 'string') throw new BadRequestError(
      message('BufferEncoding', options.language, {
        bufferEncoding: bufferEncoding
      }))

    return new Buffer(x, bufferEncoding)
  } ],

  [ Boolean, function (x) {
    if (typeof x === 'string') return x === 'true'
    return Boolean(x)
  } ],

  [ Object, function (x, options) {
    if (typeof x === 'string') return JSON.parse(x)
    if (typeof x === 'object') return x
    throw new BadRequestError(message('JSONParse', options.language))
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
  var i, j, cast, float

  if (type)
    for (i = castByType.length; i--;) {
      j = castByType[i]
      if (j[0] === type) {
        cast = j[1]
        break
      }
    }
  else {
    // Stolen from jQuery source code:
    // https://api.jquery.com/jQuery.isNumeric/
    float = Number.parseFloat(value)
    return value - float + 1 >= 0 ? float : value
  }

  return cast && value !== null ? cast(value, options) : value
}
