export const idKey = '_id'


// Assign default values per schema field.
export function inputRecord (type, record) {
  const clone = {}
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  const id = record[keys.primary]
  if (id) clone[idKey] = id

  for (let field in record) {
    clone[field] = record[field]
  }

  for (let field of Object.getOwnPropertyNames(schema))
    if (!(field in record))
      clone[field] = schema[field][keys.isArray] ? [] : null

  return clone
}


export function outputRecord (type, record) {
  const clone = {}
  const { schemas, keys } = this
  const schema = schemas[type]
  const toBuffer = object => object.buffer

  // ID business.
  clone[keys.primary] = record[idKey]

  // Non-native types.
  for (let field of Object.keys(record)) {
    if (!(field in schema)) continue

    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    // Expose native Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(toBuffer) :
        record[field].buffer
      continue
    }

    clone[field] = record[field]
  }

  return clone
}


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} map should return the first argument, which is the value
 * @return {Object}
 */
export function mapValues (object, map) {
  return Object.keys(object).reduce((clone, key) =>
    Object.assign(clone, { [key]: map(object[key], key) }), {})
}
