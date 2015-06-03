import * as keys from '../common/keys'


// Generate denormalized inverse field name.
const denormalizedPrefix = '__'
const denormalizedDelimiter = '_'
const denormalizedPostfix = '_inverse'


/**
 * Do static analysis on the `recordTypes` object to see if `link` and
 * `inverse` values are valid. Also assign denormalized inverse fields.
 *
 * @param {Object} recordTypes
 */
export default function ensureTypes (recordTypes) {
  for (let type in recordTypes) {
    const fields = recordTypes[type]

    for (let field in fields) {
      const definition = fields[field]

      if (!(keys.link in definition)) continue

      if (!(definition[keys.link] in recordTypes))
        throw new Error(`The value for "${keys.link}" on "${field}" is ` +
          `invalid, the record type does not exist.`)

      const linkedFields = recordTypes[definition[keys.link]]

      if (keys.inverse in definition) {
        if (!(definition[keys.inverse] in linkedFields))
          throw new Error(`The value for "${keys.inverse}" on "${field}" ` +
            `is invalid, the field does not exist.`)

        if (linkedFields[definition[keys.inverse]][keys.inverse] !== field)
          throw new Error(`The value for "${keys.inverse}" on "${field}" ` +
            `is invalid, the inversely related field must define its ` +
            `inverse as "${field}".`)

        continue
      }

      // Need to assign denormalized inverse. The denormalized inverse field
      // is basically an automatically assigned inverse field that should
      // not be visible to the client, but exists in the data store.
      const denormalizedField = `${denormalizedPrefix}${type}` +
        `${denormalizedDelimiter}${field}${denormalizedPostfix}`

      Object.defineProperty(definition, keys.inverse, {
        value: denormalizedField
      })

      Object.defineProperty(linkedFields, denormalizedField, {
        value: {
          [keys.link]: type,
          [keys.isArray]: true,
          [keys.denormalizedInverse]: true
        }
      })
    }
  }
}
