import {
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey,
  denormalizedInverse as denormalizedInverseKey
} from '../common/keys'


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

      if (!(linkKey in definition)) continue

      if (!(definition[linkKey] in recordTypes))
        throw new Error(`The value for "${linkKey}" on "${field}" is ` +
          `invalid, the record type does not exist.`)

      const linkedFields = recordTypes[definition[linkKey]]

      if (inverseKey in definition) {
        if (!(definition[inverseKey] in linkedFields))
          throw new Error(`The value for "${inverseKey}" on "${field}" ` +
            `is invalid, the field does not exist.`)

        if (linkedFields[definition[inverseKey]][inverseKey] !== field)
          throw new Error(`The value for "${inverseKey}" on "${field}" ` +
            `is invalid, the inversely related field must define its ` +
            `inverse as "${field}".`)

        if (linkedFields[definition[inverseKey]][linkKey] !== type)
          throw new Error(`The value for "${linkKey}" on "${field}" ` +
            `is invalid, the inversely related field must define its ` +
            `link as "${type}".`)

        continue
      }

      // Need to assign denormalized inverse. The denormalized inverse field
      // is basically an automatically assigned inverse field that should
      // not be visible to the client, but exists in the data store.
      const denormalizedField = `${denormalizedPrefix}${type}` +
        `${denormalizedDelimiter}${field}${denormalizedPostfix}`

      Object.defineProperty(definition, inverseKey, {
        value: denormalizedField
      })

      Object.defineProperty(linkedFields, denormalizedField, {
        value: {
          [linkKey]: type,
          [inverseKey]: field,
          [isArrayKey]: true,
          [denormalizedInverseKey]: true
        }
      })
    }
  }
}
