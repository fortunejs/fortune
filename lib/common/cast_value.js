'use strict'

var errors = require('./errors')
var message = require('./message')
var castToNumber = require('./cast_to_number')
var BadRequestError = errors.BadRequestError
var buffer = Buffer.from || function (input, encoding) {
  return new Buffer(input, encoding)
}


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

    return buffer(x, bufferEncoding)
  } ],

  [ Boolean, function (x) {
    if (typeof x === 'string')
      return (/^(?:true|1|yes|t|y)$/i).test(x)
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
  var i, j, pair, hasMatch, cast

  // Special case for empty string: it should be null.
  if (value === '') return null

  if (type)
    for (i = 0, j = castByType.length; i < j; i++) {
      pair = castByType[i]
      hasMatch = pair[0] === type || pair[0].name === type.name

      if (!hasMatch)
        try {
          hasMatch = pair[0] === type.prototype.constructor
        }
        catch (e) {
          // Swallow this error.
        }

      if (hasMatch) {
        cast = pair[1]
        break
      }
    }
  else return castToNumber(value)

  return cast && value !== null ? cast(value, options) : value
}
