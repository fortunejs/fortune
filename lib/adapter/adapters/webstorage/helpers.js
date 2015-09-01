import clone from 'clone'
import { generateId } from '../common'


export const delimiter = '__'


const bufferEncoding = 'base64'


export function inputRecord (type, record) {
  const { recordTypes, keys: {
    primary: primaryKey, type: typeKey, isArray: isArrayKey
  } } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][typeKey]
    const fieldIsArray = fields[field][isArrayKey]

    if (!(field in record)) {
      result[field] = fieldIsArray ? [] : null
      continue
    }

    const value = clone(record[field])

    // Cast Buffer to String.
    if (fieldType === Buffer && value) {
      result[field] = fieldIsArray ? value.map(toString) : toString(value)
      continue
    }

    result[field] = value
  }

  return result
}


export function outputRecord (type, record) {
  const { recordTypes, keys: {
    primary: primaryKey, type: typeKey, isArray: isArrayKey,
    denormalizedInverse: denormalizedInverseKey
  } } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[primaryKey] = record[primaryKey]

  for (let field in record) {
    if (!(field in fields)) continue

    const value = clone(record[field])
    const fieldType = fields[field][typeKey]
    const fieldIsArray = fields[field][isArrayKey]
    const fieldIsDenormalized = fields[field][denormalizedInverseKey]

    // Cast String to Buffer.
    if (fieldType === Buffer && record[field]) {
      result[field] = fieldIsArray ? value.map(toBuffer) : toBuffer(value)
      continue
    }

    // Cast String to Date.
    if (fieldType === Date && record[field]) {
      result[field] = fieldIsArray ? value.map(toDate) : toDate(value)
      continue
    }

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value
      })
      continue
    }

    result[field] = value
  }

  return result
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
