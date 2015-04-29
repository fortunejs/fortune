import * as keys from '../common/reserved_keys'


const nativeTypes = new Set([ String, Number, Boolean, Date, Object, Buffer ])


/**
 * Given a schema object, validate its fields.
 *
 * @param {Object} schema
 * @return {Object}
 */
export default function validate (schema = {}) {
  for (let key in schema) {
    validateField(schema[key], key)
  }
  return schema
}


/**
 * Parse an object on a schema field.
 *
 * @param {Object} value
 * @param {String} key
 */
function validateField (value, key) {
  if (typeof value !== 'object' || value.constructor !== Object)
    throw new TypeError(`The definition of "${key}" must be an object.`)

  if (key === keys.primary)
    throw new Error(`Can not define primary key.`)

  if (!value.hasOwnProperty(keys.type) && !value.hasOwnProperty(keys.link))
    throw new Error(`The definition of "${key}" must contain either the ` +
      `"${keys.type}" or "${keys.link}" property.`)

  if (value.hasOwnProperty(keys.type) && value.hasOwnProperty(keys.link))
    throw new Error(`Can not define both "${keys.type}" and "${keys.link}" ` +
      `on "${key}".`)

  if (value.hasOwnProperty(keys.type)) {
    if (!nativeTypes.has(value[keys.type]) &&
      typeof value[keys.type] !== 'symbol')
        throw new Error(`The "${keys.type}" on "${key}" is invalid.`)

    if (value.hasOwnProperty(keys.inverse))
      throw new Error(`The field "${keys.inverse}" may not be defined ` +
        `on "${key}."`)
  }

  if (value.hasOwnProperty(keys.link)) {
    if (typeof value[keys.link] !== 'string')
      throw new TypeError(`The "${keys.link}" on "${key}" must be a string.`)

    if (!value.hasOwnProperty(keys.inverse))
      throw new Error(`The link "${key}" must also have an ` +
        `"${keys.inverse}" field.`)

    if (typeof value[keys.inverse] !== 'string')
      throw new TypeError(`The "${keys.inverse}" on "${key}" ` +
        `must be a string.`)
  }

  if (value.hasOwnProperty(keys.isArray) &&
    typeof value[keys.isArray] !== 'boolean')
      throw new TypeError(`The "${keys.isArray}" on "${key}" ` +
        `must be a boolean.`)
}
