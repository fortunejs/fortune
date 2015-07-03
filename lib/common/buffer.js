// Thanks kraag22.
// http://stackoverflow.com/a/17064149/4172219
export function toBuffer (arrayBuffer) {
  return new Buffer(new Uint8Array(arrayBuffer))
}


// Thanks Martin Thomson.
// http://stackoverflow.com/a/12101012/4172219
export function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)

  for (let i = 0; i < buffer.length; i++) view[i] = buffer[i]

  return arrayBuffer
}
