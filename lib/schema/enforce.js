import * as errors from '../common/errors'
import * as keys from '../common/reserved_keys'
import * as arrayProxy from '../common/array_proxy'


// Check input values.
const checkInput = new WeakMap([
  [ String, value => typeof value === 'string' ],
  [ Number, value => typeof value === 'number' ],
  [ Boolean, value => typeof value === 'boolean' ],
  [ Date, value => value instanceof Date ],
  [ Object, value => value && typeof value === 'object' ],
  [ Buffer, value => Buffer.isBuffer(value) ]
])


/**
 * Throw errors for mismatched types on a record.
 *
 * @param {String} type
 * @param {Object} record
 * @param {Object} schema
 * @param {Boolean} dropFields
 * @return {Object}
 */
export default function enforce (type, record, schema, dropFields) {
  for (let key in record) {
    if (!(key in schema)) {
      if (dropFields && key !== keys.primary) delete record[key]
      continue
    }

    const value = record[key]

    if (keys.type in schema[key])
      if (schema[key][keys.isArray]) {
        // If the field is defined as an array but the value is not,
        // then throw an error.
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array with values of type ` +
            `${schema[key][keys.type].name.toLowerCase()}.`)

        for (let item of value)
          checkValue(schema[key], key, item)
      }
      else checkValue(schema[key], key, value)

    if (keys.link in schema[key])
      if (schema[key][keys.isArray]) {
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array.`)
        if (type === schema[key][keys.link] &&
          arrayProxy.find(value, findPrimary.bind(null, record)))
          throw new errors.BadRequestError(`An ID of "${key}" is ` +
            `invalid, it cannot be the ID of the record.`)
      }
    else {
      if (value !== null && typeof value === 'object')
        throw new errors.BadRequestError(`The value of "${key}" is ` +
          `invalid, it must be a singular value.`)
      if (type === schema[key][keys.link] && value === record[keys.primary])
        throw new errors.BadRequestError(`The ID of "${key}" is ` +
          `invalid, it cannot be the ID of the record.`)
    }
  }

  return record
}


function checkValue (field, key, value) {
  // If the field type is a symbol, there is nothing to enforce.
  if (typeof field[keys.type] === 'symbol') return

  // Fields are nullable, but if they're not they must be defined properly.
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
