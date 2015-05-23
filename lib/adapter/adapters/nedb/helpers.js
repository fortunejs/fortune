const bufferEncoding = 'base64'
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

  Object.getOwnPropertyNames(schema).forEach(field => {
    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      return
    }

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(buffer => buffer.toString(bufferEncoding)) :
        record[field].toString(bufferEncoding)
      return
    }
  })

  return clone
}


// We get a new object for each record from NeDB, so we don't have to worry
// about cloning.
export function outputRecord (type, record) {
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  const id = record[idKey]
  delete record[idKey]
  record[keys.primary] = id

  // Non-native types.
  Object.keys(record).forEach(field => {
    if (!(field in schema)) return

    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field])
      record[field] = fieldIsArray ?
        record[field].map(string => new Buffer(string, bufferEncoding)) :
        new Buffer(record[field], bufferEncoding)
  })

  return record
}


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} map should return the first argument, which is the value
 * @return {Object}
 */
export function mapValues (object, map) {
  return Object.keys(object).reduce((clone, key) => {
    clone[key] = map(object[key], key)
    return clone
  }, {})
}
