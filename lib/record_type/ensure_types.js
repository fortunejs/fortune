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
 * Analyze the `recordTypes` object to see if `link` and `inverse` values are
 * valid. Also assign denormalized inverse fields.
 *
 * @param {Object} recordTypes
 */
module.exports = function ensureTypes (recordTypes) {
  var recordTypesArray = Object.keys(recordTypes)
  var i, j, type, field, fields, fieldsArray, definition,
    linkedFields, denormalizedField, denormalizedDefinition

  for (i = recordTypesArray.length; i--;) {
    type = recordTypesArray[i]
    fields = recordTypes[type]
    fieldsArray = Object.keys(fields)

    for (j = fieldsArray.length; j--;) {
      field = fieldsArray[j]
      definition = fields[field]

      if (!(linkKey in definition)) continue

      if (!(definition[linkKey] in recordTypes))
        throw new Error('The value for "' + linkKey + '" on "' + field +
          '" is invalid, the record type does not exist.')

      linkedFields = recordTypes[definition[linkKey]]

      if (inverseKey in definition) {
        if (!(definition[inverseKey] in linkedFields))
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" is invalid, the field does not exist.')

        if (linkedFields[definition[inverseKey]][inverseKey] !== field)
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" is invalid, the inversely related field must define its ' +
            'inverse as "' + field + '".')

        if (linkedFields[definition[inverseKey]][linkKey] !== type)
          throw new Error('The value for "' + linkKey + '" on "' + field +
            '" is invalid, the inversely related field must define its link ' +
            'as "' + type + '".')

        continue
      }

      // Need to assign denormalized inverse. The denormalized inverse field
      // is basically an automatically assigned inverse field that should
      // not be visible to the client, but exists in the data store.
      denormalizedField = denormalizedPrefix + type +
        denormalizedDelimiter + field + denormalizedPostfix

      Object.defineProperty(definition, inverseKey, {
        value: denormalizedField
      })

      denormalizedDefinition = {}
      denormalizedDefinition[linkKey] = type
      denormalizedDefinition[inverseKey] = field
      denormalizedDefinition[isArrayKey] = true
      denormalizedDefinition[denormalizedInverseKey] = true

      Object.defineProperty(linkedFields, denormalizedField, {
        value: denormalizedDefinition
      })
    }
  }
}
