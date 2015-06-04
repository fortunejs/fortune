import * as errors from '../common/errors'
import * as keys from '../common/keys'


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
 * @param {Boolean} dropFields - Whether or not to drop fields that are not
 * defined in the record type.
 * @return {Object}
 */
export default function enforce (type, record, fields, dropFields) {
  for (let key in record) {
    if (!(key in fields)) {
      if (dropFields && key !== keys.primary) delete record[key]
      continue
    }

    const value = record[key]

    if (keys.type in fields[key]) {
      if (fields[key][keys.isArray]) {
        // If the field is defined as an array but the value is not,
        // then throw an error.
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array with values of type ` +
            `${fields[key][keys.type].name.toLowerCase()}.`)

        for (let item of value)
          checkValue(fields[key], key, item)
      }
      else checkValue(fields[key], key, value)

      continue
    }

    if (keys.link in fields[key]) {
      if (fields[key][keys.isArray]) {
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array.`)

        if (type === fields[key][keys.link] &&
          value.some(findPrimary.bind(null, record)))
          throw new errors.BadRequestError(`An ID of "${key}" is ` +
            `invalid, it cannot be the ID of the record.`)

        continue
      }

      if (Array.isArray(value))
        throw new errors.BadRequestError(`The value of "${key}" is ` +
          `invalid, it must be a singular value.`)

      if (type === fields[key][keys.link] && findPrimary(record, value))
        throw new errors.BadRequestError(`The ID of "${key}" is ` +
          `invalid, it cannot be the ID of the record.`)

      continue
    }
  }

  return record
}


function checkValue (field, key, value) {
  // If the field type is a symbol, then there is nothing to enforce.
  if (typeof field[keys.type] === 'symbol') return

  // Fields may be nullable, but if they're defined, then they must be defined
  // properly.
  if (value !== null && !checkInput.get(field[keys.type])(value))
    throw new errors.BadRequestError(field[keys.isArray] ?
      `A value in the array of "${key}" is invalid, it must be a ` +
      `${field[keys.type].name.toLowerCase()}.` :
      `The value of "${key}" is invalid, it must be a ` +
      `${field[keys.type].name.toLowerCase()}.`)
}


function findPrimary (record, id) {
  return record[keys.primary] === id
}
