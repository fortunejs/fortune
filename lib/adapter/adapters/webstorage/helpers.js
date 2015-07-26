export const delimiter = '__'


const bufferEncoding = 'base64'


export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  clone[keys.primary] = keys.primary in record ?
    record[keys.primary] : generateId()

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    const value = record[field]

    // Cast Buffer to String.
    if (fieldType === Buffer && value) {
      clone[field] = fieldIsArray ? value.map(toString) : toString(value)
      continue
    }

    clone[field] = value
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

    // Cast String to Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ? value.map(toBuffer) : toBuffer(value)
      continue
    }

    // Cast String to Date.
    if (fieldType === Date && record[field]) {
      clone[field] = fieldIsArray ? value.map(toDate) : toDate(value)
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


function toString (buffer) {
  return buffer.toString(bufferEncoding)
}


function toBuffer (string) {
  return new Buffer(string, bufferEncoding)
}


function toDate (string) {
  return new Date(Date.parse(string))
}


// Hopefully we don't need to do this.
function generateId () {
  return ('00000000' + Math.floor(Math.random() * Math.pow(2, 32))
    .toString(16)).slice(-8)
}
