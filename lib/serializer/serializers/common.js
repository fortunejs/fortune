export const castString = new WeakMap([
  [ Number, x => parseInt(x, 10) ],
  [ Date, x => new Date(x) ],
  [ Buffer, (x, options) => new Buffer(x, options.bufferEncoding) ],
  [ Boolean, x => x === 'true' ],
  [ Object, x => JSON.parse(x) ]
])


export function castValue (value, type, options) {
  const { bufferEncoding } = options

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), bufferEncoding)

  return value
}
