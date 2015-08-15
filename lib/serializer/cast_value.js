import { BadRequestError } from '../common/errors'


const castByType = new WeakMap([
  [ Number, x => parseInt(x, 10) ],

  [ Date, x => {
    if (typeof x === 'string') {
      x = Date.parse(x)
      if (Number.isNaN(x)) throw new BadRequestError(
        `Date string must be an ISO 8601 formatted string.`)
    }
    x = new Date(x)
    if (Number.isNaN(x.getTime())) throw new BadRequestError(
      `Date value is invalid.`)
    return x
  } ],

  [ Buffer, (x, options = {}) => {
    const bufferEncoding = options.bufferEncoding || 'base64'

    if (typeof x !== 'string') throw new BadRequestError(
      `Buffer value must be a ${bufferEncoding}-encoded string.`)
    return new Buffer(x, bufferEncoding)
  } ],

  [ Boolean, x => {
    if (typeof x === 'string') return x === 'true'
    return Boolean(x)
  } ],

  [ Object, x => {
    if (typeof x === 'string') return JSON.parse(x)
    if (typeof x === 'object') return x
    throw new BadRequestError(`Could not cast "${x}" to JSON.`)
  } ],

  [ String, x => x.toString() ]
])


/**
 * Cast a value to the given type. Skip if type is missing or value is null.
 *
 * @param {*} value
 * @param {Function} type - Constructor function.
 * @param {Object} [options]
 * @return {*}
 */
export default function castValue (value, type, options) {
  return type && castByType.has(type) && value !== null ?
    castByType.get(type)(value, options) : value
}
