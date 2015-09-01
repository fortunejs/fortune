import clone from 'clone'
import { generateId } from '../common'


export function inputRecord (type, record) {
  const { recordTypes, keys: {
    primary: primaryKey, isArray: isArrayKey
  } } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (let field of Object.getOwnPropertyNames(fields)) {
    if (!(field in record)) {
      result[field] = fields[field][isArrayKey] ? [] : null
      continue
    }

    result[field] = clone(record[field])
  }

  return result
}


export function outputRecord (type, record) {
  const { recordTypes, keys: {
    primary: primaryKey, isArray: isArrayKey,
    denormalizedInverse: denormalizedInverseKey
  } } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[primaryKey] = record[primaryKey]

  for (let field of Object.getOwnPropertyNames(fields)) {
    const value = field in record ? clone(record[field]) :
      fields[field][isArrayKey] ? [] : null

    // Do not enumerate denormalized fields.
    if (fields[field][denormalizedInverseKey]) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value
      })
      continue
    }

    if (field in record) result[field] = value
  }

  return result
}
