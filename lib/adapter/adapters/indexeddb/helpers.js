import * as buffer from '../../../common/buffer'


// Unfortunately, IndexedDB implementations are pretty buggy. This adapter
// tries to work around the incomplete and buggy implementations of IE10+ and
// iOS 8+.


// This is for ensuring that type/ID combination is unique.
// https://stackoverflow.com/questions/26019147
export const idDelimiter = '##'


export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  clone[keys.primary] = type + idDelimiter + (keys.primary in record ?
    record[keys.primary] : generateId())

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    const value = record[field]

    // Cast Buffer to ArrayBuffer.
    if (fieldType === Buffer && value) {
      clone[field] = fieldIsArray ?
        value.map(buffer.toArrayBuffer) : buffer.toArrayBuffer(value)
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
  const id = record[keys.primary].split(idDelimiter)[1]
  const float = Number.parseFloat(id)
  clone[keys.primary] = id - float + 1 >= 0 ? float : id

  for (let field in record) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]
    const fieldIsDenormalized = fields[field][keys.denormalizedInverse]

    // Cast ArrayBuffer to Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        value.map(buffer.toBuffer) : buffer.toBuffer(value)
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


// Return the global object. Thanks Axel Rauschmayer.
// https://gist.github.com/rauschma/1bff02da66472f555c75
export function getGlobalObject () {
  // Workers don’t have `window`, only `self`.
  if (typeof self !== 'undefined') return self // eslint-disable-line no-undef

  // Node.js detection.
  if (typeof global !== 'undefined') return global

  // Not all environments allow eval and Function. Use only as a last resort:
  return new Function('return this')() // eslint-disable-line no-new-func
}


// Hopefully we don't need to do this.
function generateId () {
  return ('00000000' + Math.floor(Math.random() * Math.pow(2, 32))
    .toString(16)).slice(-8)
}
