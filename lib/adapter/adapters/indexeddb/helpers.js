import clone from 'clone'
import { generateId } from '../common'
import { toBuffer, toArrayBuffer } from 'array-buffer'


// Unfortunately, IndexedDB implementations are pretty buggy. This adapter
// tries to work around the incomplete and buggy implementations of IE10+ and
// iOS 8+.


// This is for ensuring that type/ID combination is unique.
// https://stackoverflow.com/questions/26019147
export const delimiter = '__'


export function inputRecord (type, record) {
  const { recordTypes, keys: {
    primary: primaryKey, type: typeKey, isArray: isArrayKey
  } } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[primaryKey] = type + delimiter + (primaryKey in record ?
    record[primaryKey] : generateId())

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][typeKey]
    const fieldIsArray = fields[field][isArrayKey]

    if (!(field in record)) {
      result[field] = fieldIsArray ? [] : null
      continue
    }

    const value = record[field]

    // Cast Buffer to ArrayBuffer.
    if (fieldType === Buffer && value) {
      result[field] = fieldIsArray ?
        value.map(toArrayBuffer) : toArrayBuffer(value)
      continue
    }

    result[field] = clone(value)
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
  const id = record[primaryKey].split(delimiter)[1]
  const float = Number.parseFloat(id)
  result[primaryKey] = id - float + 1 >= 0 ? float : id

  for (let field in record) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][typeKey]
    const fieldIsArray = fields[field][isArrayKey]
    const fieldIsDenormalized = fields[field][denormalizedInverseKey]

    // Cast ArrayBuffer to Buffer.
    if (fieldType === Buffer && record[field]) {
      result[field] = fieldIsArray ?
        value.map(toBuffer) : toBuffer(value)
      continue
    }

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value: clone(value)
      })
      continue
    }

    result[field] = clone(value)
  }

  return result
}
