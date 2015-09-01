import { BadRequestError } from '../common/errors'
import {
  primary as primaryKey,
  type as typeKey,
  link as linkKey,
  isArray as isArrayKey
} from '../common/keys'


// Check input values.
const checkInput = new WeakMap([
  [ String, value => typeof value === 'string' ],
  [ Number, value => typeof value === 'number' ],
  [ Boolean, value => typeof value === 'boolean' ],
  [ Date, value => value instanceof Date && !Number.isNaN(value.valueOf()) ],
  [ Object, value => value !== null && typeof value === 'object' ],
  [ Buffer, value => Buffer.isBuffer(value) ]
])


/**
 * Throw errors for mismatched types on a record.
 *
 * @param {String} type
 * @param {Object} record
 * @param {Object} fields
 * @return {Object}
 */
export default function enforce (type, record, fields) {
  for (let key in record) {
    if (!(key in fields)) {
      if (key !== primaryKey) delete record[key]
      continue
    }

    const value = record[key]

    if (typeKey in fields[key]) {
      if (fields[key][isArrayKey]) {
        // If the field is defined as an array but the value is not,
        // then throw an error.
        if (!Array.isArray(value))
          throw new BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array with values of type ` +
            `${fields[key][typeKey].name.toLowerCase()}.`)

        for (let item of value)
          checkValue(fields[key], key, item)
      }
      else checkValue(fields[key], key, value)

      continue
    }

    if (linkKey in fields[key]) {
      if (fields[key][isArrayKey]) {
        if (!Array.isArray(value))
          throw new BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array.`)

        if (type === fields[key][linkKey] &&
          value.some(findPrimary.bind(null, record)))
          throw new BadRequestError(`An ID of "${key}" is ` +
            `invalid, it cannot be the ID of the record.`)

        continue
      }

      if (Array.isArray(value))
        throw new BadRequestError(`The value of "${key}" is ` +
          `invalid, it must be a singular value.`)

      if (type === fields[key][linkKey] && findPrimary(record, value))
        throw new BadRequestError(`The ID of "${key}" is ` +
          `invalid, it cannot be the ID of the record.`)

      continue
    }
  }

  return record
}


function checkValue (field, key, value) {
  // If the field type is a symbol, then there is nothing to enforce.
  if (typeof field[typeKey] === 'symbol') return

  // Fields may be nullable, but if they're defined, then they must be defined
  // properly.
  if (value !== null && !checkInput.get(field[typeKey])(value))
    throw new BadRequestError(field[isArrayKey] ?
      `A value in the array of "${key}" is invalid, it must be a ` +
      `${field[typeKey].name.toLowerCase()}.` :
      `The value of "${key}" is invalid, it must be a ` +
      `${field[typeKey].name.toLowerCase()}.`)
}


function findPrimary (record, id) {
  return record[primaryKey] === id
}
