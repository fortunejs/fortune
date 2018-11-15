'use strict'

var keys = require('../common/keys')
var linkKey = keys.link
var inverseKey = keys.inverse
var isArrayKey = keys.isArray
var denormalizedInverseKey = keys.denormalizedInverse


// Generate denormalized inverse field name.
var denormalizedPrefix = '__'
var denormalizedDelimiter = '_'
var denormalizedPostfix = '_inverse'


/**
 * Analyze the `types` object to see if `link` and `inverse` values are
 * valid. Also assign denormalized inverse fields.
 *
 * @param {Object} types
 * @return {Object}
 */
module.exports = function ensureTypes (types) {
  var denormalizedFields = {}
  var type, field, definition, linkedFields,
    denormalizedField, denormalizedDefinition

  for (type in types)
    for (field in types[type]) {
      definition = types[type][field]

      if (!(linkKey in definition)) continue

      if (!types.hasOwnProperty(definition[linkKey]))
        throw new Error('The value for "' + linkKey + '" on "' + field +
          '" in type "' + type +
          '" is invalid, the record type does not exist.')

      linkedFields = types[definition[linkKey]]

      if (inverseKey in definition) {
        if (!linkedFields.hasOwnProperty(definition[inverseKey]))
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" in type "' + type + '" is invalid, the field does not exist.')

        if (linkedFields[definition[inverseKey]][inverseKey] !== field)
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" in type "' + type +
            '" is invalid, the inversely related field must define its ' +
            'inverse as "' + field + '".')

        if (linkedFields[definition[inverseKey]][linkKey] !== type)
          throw new Error('The value for "' + linkKey + '" on "' + field +
            '" in type "' + type +
            '" is invalid, the inversely related field must define its link ' +
            'as "' + type + '".')

        continue
      }

      // Need to assign denormalized inverse. The denormalized inverse field
      // is basically an automatically assigned inverse field that should
      // not be visible to the client, but exists in the data store.
      denormalizedField = denormalizedPrefix + type +
        denormalizedDelimiter + field + denormalizedPostfix

      denormalizedFields[denormalizedField] = true

      Object.defineProperty(definition, inverseKey, {
        value: denormalizedField
      })

      denormalizedDefinition = {}
      denormalizedDefinition[linkKey] = type
      denormalizedDefinition[inverseKey] = field
      denormalizedDefinition[isArrayKey] = true
      denormalizedDefinition[denormalizedInverseKey] = true

      Object.defineProperty(linkedFields, denormalizedField, {
        value: denormalizedDefinition,
        writable: true,
        configurable: true
      })
    }

  return denormalizedFields
}
