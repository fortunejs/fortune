export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  const id = record[keys.primary]
  if (id) clone[keys.primary] = id

  for (let field in record) {
    clone[field] = record[field]
  }

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    // Cast Buffer to ArrayBuffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(toArrayBuffer) :
        toArrayBuffer(record[field])
      continue
    }
  }

  return clone
}


export function outputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  clone[keys.primary] = record[keys.primary]

  for (let field in record) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]
    const fieldIsDenormalized = fields[field][keys.denormalizedInverse]

    // Cast ArrayBuffer to Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ? value.map(toBuffer) : toBuffer(value)
      continue
    }

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      Object.defineProperty(clone, field, {
        configurable: true, writable: true, value
      })
      continue
    }

    clone[field] = record[field]
  }

  return clone
}


// Thanks kraag22.
// http://stackoverflow.com/a/17064149/4172219
function toBuffer (arrayBuffer) {
  return new Buffer(new Uint8Array(arrayBuffer))
}


// Thanks Martin Thomson.
// http://stackoverflow.com/a/12101012/4172219
function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; i++)
    view[i] = buffer[i]

  return arrayBuffer
}
