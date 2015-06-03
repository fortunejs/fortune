import * as keys from '../common/keys'


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

  if (key === keys.primary)
    throw new Error(`Can not define primary key.`)

  if (!(keys.type in value) && !(keys.link in value))
    throw new Error(`The definition of "${key}" must contain either the ` +
      `"${keys.type}" or "${keys.link}" property.`)

  if (keys.type in value && keys.link in value)
    throw new Error(`Can not define both "${keys.type}" and "${keys.link}" ` +
      `on "${key}".`)

  if (keys.type in value) {
    if (!nativeTypes.has(value[keys.type]) &&
      typeof value[keys.type] !== 'symbol')
        throw new Error(`The "${keys.type}" on "${key}" is invalid.`)

    if (keys.inverse in value)
      throw new Error(`The field "${keys.inverse}" may not be defined ` +
        `on "${key}."`)
  }

  if (keys.link in value) {
    if (typeof value[keys.link] !== 'string')
      throw new TypeError(`The "${keys.link}" on "${key}" must be a string.`)

    if (keys.inverse in value && typeof value[keys.inverse] !== 'string')
      throw new TypeError(`The "${keys.inverse}" on "${key}" ` +
        `must be a string.`)
  }

  if (keys.isArray in value && typeof value[keys.isArray] !== 'boolean')
      throw new TypeError(`The key "${keys.isArray}" on "${key}" ` +
        `must be a boolean.`)
}
