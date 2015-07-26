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
    if (typeof value !== 'string') return null
    return new Date(Date.parse(value))
  }

  if (type === Buffer) {
    if (typeof value !== 'string') return null
    return new Buffer(value, bufferEncoding)
  }

  return value
}
