export const castString = new WeakMap([
  [ Number, x => parseInt(x, 10) ],
  [ Date, x => new Date(Date.parse(x)) ],
  [ Buffer, (x, options) => new Buffer(x, options.bufferEncoding) ],
  [ Boolean, x => x === 'true' ],
  [ Object, x => JSON.parse(x) ]
])


const castByType = new WeakMap([
  [ Date, (x, options) => {
    const { errors: { BadRequestError } } = options

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

  [ Buffer, (x, options) => {
    let { bufferEncoding, errors: { BadRequestError } } = options
    if (!bufferEncoding) bufferEncoding = 'base64'

    if (typeof x !== 'string') throw new BadRequestError(
      `Buffer value must be a ${bufferEncoding}-encoded string.`)
    return new Buffer(x, bufferEncoding)
  } ]
])


export function castValue (value, type, options) {
  // Skip casting for null value.
  if (value === null) return null

  options.errors = this.errors

  return type && castByType.has(type) ?
    castByType.get(type)(value, options) : value
}
