import clone from 'clone'
import { generateId } from '../common'


export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[keys.primary] = keys.primary in record ?
    record[keys.primary] : generateId()

  for (let field of Object.getOwnPropertyNames(fields)) {
    if (!(field in record)) {
      result[field] = fields[field][keys.isArray] ? [] : null
      continue
    }

    result[field] = clone(record[field])
  }

  return result
}


export function outputRecord (type, record) {
  const { recordTypes, keys } = this
  const result = {}
  const fields = recordTypes[type]

  // ID business.
  result[keys.primary] = record[keys.primary]

  for (let field in record) {
    if (!(field in fields)) continue

    const value = clone(record[field])

    // Do not enumerate denormalized fields.
    if (fields[field][keys.denormalizedInverse]) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value
      })
      continue
    }

    result[field] = value
  }

  return result
}
