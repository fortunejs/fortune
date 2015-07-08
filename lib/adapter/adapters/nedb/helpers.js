import crypto from 'crypto'


const bufferEncoding = 'base64'


export const idKey = '_id'


// Cast and assign values per field.
export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]
  const toString = buffer => buffer.toString(bufferEncoding)

  // ID business.
  const id = record[keys.primary]
  clone[idKey] = id ? id : generateId()

  for (let field in record) {
    if (field === keys.primary) continue
    clone[field] = record[field]
  }

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(toString) :
        toString(record[field])
      continue
    }
  }

  return clone
}


export function outputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]
  const toBuffer = string => new Buffer(string, bufferEncoding)

  // ID business.
  const id = record[idKey]
  clone[keys.primary] = id

  for (let field in record) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]
    const fieldIsDenormalized = fields[field][keys.denormalizedInverse]

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        value.map(toBuffer) : new Buffer(value, bufferEncoding)
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


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} map should return the first argument, which is the value
 * @return {Object}
 */
export function mapValues (object, map) {
  return Object.keys(object).reduce((clone, key) =>
    Object.assign(clone, { [key]: map(object[key], key) }), {})
}


/**
 * Cast non-native types.
 *
 * @param {*} value
 * @return {*}
 */
export function castValue (value) {
  if (Buffer.isBuffer(value))
    return value.toString(bufferEncoding)

  return value
}


/**
 * Generate base64 string from 15 bytes of strong randomness (this is 2 less
 * bits of entropy than UUID version 4). It is ideal for the length of the
 * input to be divisible by 3, since base64 expands the binary input by
 * exactly 1 byte for every 3 bytes, and adds padding length of modulus 3.
 *
 * @return {String}
 */
function generateId () {
  return crypto.randomBytes(15).toString('base64')
}
