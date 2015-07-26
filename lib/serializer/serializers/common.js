import { BadRequestError } from '../../common/errors'


export const castString = new WeakMap([
  [ Number, x => parseInt(x, 10) ],
  [ Date, x => new Date(Date.parse(x)) ],
  [ Buffer, (x, options) => new Buffer(x, options.bufferEncoding) ],
  [ Boolean, x => x === 'true' ],
  [ Object, x => JSON.parse(x) ]
])


export function castValue (value, type, options) {
  const { bufferEncoding } = options

  if (type === Date) {
    if (typeof value !== 'string') throw new BadRequestError(
      `Date value must be an ISO 8601 formatted string.`)
    return new Date(Date.parse(value))
  }

  if (type === Buffer) {
    if (typeof value !== 'string') throw new BadRequestError(
      `Buffer value must be a ${bufferEncoding}-encoded string.`)
    return new Buffer(value, bufferEncoding)
  }

  return value
}
