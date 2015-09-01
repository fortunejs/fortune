import {
  primary as primaryKey,
  type as typeKey,
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey
} from '../common/keys'


const nativeTypes = new Set([ String, Number, Boolean, Date, Object, Buffer ])


/**
 * Given a hash of field definitions, validate that the definitions are in the
 * correct format.
 *
 * @param {Object} fields
 * @return {Object}
 */
export default function validate (fields = {}) {
  for (let key in fields)
    validateField(fields[key], key)

  return fields
}


/**
 * Parse a field definition.
 *
 * @param {Object} value
 * @param {String} key
 */
function validateField (value, key) {
  if (typeof value !== 'object' || value.constructor !== Object)
    throw new TypeError(`The definition of "${key}" must be an object.`)

  if (key === primaryKey)
    throw new Error(`Can not define primary key.`)

  if (!(typeKey in value) && !(linkKey in value))
    throw new Error(`The definition of "${key}" must contain either the ` +
      `"${typeKey}" or "${linkKey}" property.`)

  if (typeKey in value && linkKey in value)
    throw new Error(`Can not define both "${typeKey}" and "${linkKey}" ` +
      `on "${key}".`)

  if (typeKey in value) {
    if (!nativeTypes.has(value[typeKey]) &&
      typeof value[typeKey] !== 'symbol')
      throw new Error(`The "${typeKey}" on "${key}" is invalid.`)

    if (inverseKey in value)
      throw new Error(`The field "${inverseKey}" may not be defined ` +
        `on "${key}."`)
  }

  if (linkKey in value) {
    if (typeof value[linkKey] !== 'string')
      throw new TypeError(`The "${linkKey}" on "${key}" must be a string.`)

    if (inverseKey in value && typeof value[inverseKey] !== 'string')
      throw new TypeError(`The "${inverseKey}" on "${key}" ` +
        `must be a string.`)
  }

  if (isArrayKey in value && typeof value[isArrayKey] !== 'boolean')
    throw new TypeError(`The key "${isArrayKey}" on "${key}" ` +
        `must be a boolean.`)
}
