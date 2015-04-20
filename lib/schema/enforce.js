import primaryKey from '../common/primary_key'
import * as errors from '../common/errors'
import * as keys from './reserved_keys'
import * as arrayProxy from '../common/array_proxy'


const checkInput = new WeakMap([
  [ String, value => typeof value === 'string' ],
  [ Number, value => typeof value === 'number' ],
  [ Boolean, value => typeof value === 'boolean' ],
  [ Date, value => value instanceof Date ],
  [ Object, value => value && typeof value === 'object' ],
  [ Buffer, value => Buffer.isBuffer(value) ]
])


/**
 * Throw errors for mismatched types on a record, and drop arbitrary
 * fields that are not defined in the schema.
 *
 * @param {Object} record
 * @param {Object} schema
 * @return {Object}
 */
export default function enforce (record, schema) {
  let key

  const checkValue = function (isArray, value) {
    if (!checkInput.get(schema[key][keys.type])(value))
      throw new errors.BadRequestError(isArray ?
        `A value in the array of "${key}" is invalid, it must be a ` +
        `${schema[key][keys.type].name}.` :
        `The value of "${key}" is invalid, it must be a ` +
        `${schema[key][keys.type].name}.`)
  }

  const findPrimary = id => id === record[primaryKey]

  for (key in record) {
    const value = record[key]

    if (!schema.hasOwnProperty(key)) {
      if (key !== primaryKey)
        delete record[key]
      continue
    }

    if (schema[key][keys.type])
      if (schema[key][keys.isArray]) {
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array with values of type ` +
            `${schema[key][keys.type].name}.`)

        value.forEach(checkValue.bind(null, true))
      } else checkValue(false, value)

    if (schema[key][keys.link])
      if (schema[key][keys.isArray]) {
        if (!Array.isArray(value))
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be an array.`)
        if (arrayProxy.find(value, findPrimary))
          throw new errors.BadRequestError(`An ID of "${key}" is ` +
            `invalid, it cannot be the ID of the record.`)
      } else {
        if (typeof value === 'object')
          throw new errors.BadRequestError(`The value of "${key}" is ` +
            `invalid, it must be a singular value.`)
        if (value === record[primaryKey])
          throw new errors.BadRequestError(`The ID of "${key}" is ` +
            `invalid, it cannot be the ID of the record.`)
      }

  }

  return record
}
