'use strict'

/**
 * Define non-writable, non-configurable, enumerable properties.
 *
 * @param {Object} target
 * @param {Object} properties
 * @return {Object}
 */
module.exports = function defineEnumerable (target, properties) {
  var descriptors, keys, i, j

  if (properties === void 0) return target

  descriptors = {}
  keys = Object.keys(properties)

  for (i = keys.length; i--;) {
    j = keys[i]
    descriptors[j] = {
      value: properties[j],
      enumerable: true
    }
  }

  Object.defineProperties(target, descriptors)

  return target
}
