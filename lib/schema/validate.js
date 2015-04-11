import primaryKey from '../common/primary_key'
import keys from './reserved_keys'
import stderr from '../common/stderr'


const allowedTypes = new Set([String, Number, Boolean, Date, Object, Buffer])


/**
 * Given a schema object, validate its fields. Returns the schema object
 * with only the valid fields.
 *
 * @param {Object} schema
 * @param {Object} [options]
 * @return {Object}
 */
export default function validate (schema = {}, options = {}) {
  for (let key in schema) {
    try {
      validateField(schema[key], key)
    } catch (error) {
      stderr.warn(error.message)
      delete schema[key]
    }
  }

  Object.defineProperties(schema, {

    // Store schema options on the schema object.
    _options: {
      value: options
    },

    // Store a set of the link fields. This is used internally
    // by the dispatcher middlewares.
    _links: {
      value: new Set(Object.keys(schema)
        .filter(field => schema[field][keys.link]))
    }

  })

  return schema
}


/**
 * Parse an object on a schema field.
 *
 * @param {Object} value
 * @param {String} key
 */
function validateField (value, key) {
  if (!(value instanceof Object && value.constructor === Object))
    throw new Error(`The definition of "${key}" must be an object.`)

  if (key === primaryKey)
    throw new Error(`Can not define primary key.`)

  if (!value.hasOwnProperty(keys.type) && !value.hasOwnProperty(keys.link))
    throw new Error(`The definition of "${key}" must contain either the ` +
      `"${keys.type}" or "${keys.link}" property.`)

  if (value.hasOwnProperty(keys.type) && value.hasOwnProperty(keys.link))
    throw new Error(`Can not define both "${keys.type}" and "${keys.link}" ` +
      `on "${key}".`)

  if (value.hasOwnProperty(keys.type)) {
    if (!allowedTypes.has(value[keys.type]))
      throw new Error(`The "${keys.type}" on "${key}" is invalid.`)

    if (value.hasOwnProperty(keys.inverse))
      throw new Error(`The field "${keys.inverse}" may not be defined ` +
        `on "${key}."`)
  }

  if (value.hasOwnProperty(keys.link)) {
    if (typeof value[keys.link] !== 'string')
      throw new Error(`The "${keys.link}" on "${key}" must be a string.`)

    if (!value.hasOwnProperty(keys.inverse))
      throw new Error(`The link "${key}" must also have an ` +
        `"${keys.inverse}" field.`)

    if (typeof value[keys.inverse] !== 'string')
      throw new Error(`The "${keys.inverse}" on "${key}" must be a string.`)
  }

  if (value.hasOwnProperty(keys.isArray) &&
    typeof value[keys.isArray] !== 'boolean')
      throw new Error(`The "${keys.isArray}" on "${key}" must be a boolean.`)
}
