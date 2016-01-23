'use strict'

/**
 * Define non-writable, non-configurable, enumerable properties.
 *
 * @param {Object} target
 * @param {Object} properties
 * @return {Object}
 */
module.exports = function defineEnumerable (target, properties) {
  var descriptors = {}, key

  for (key in properties)
    descriptors[key] = { value: properties[key], enumerable: true }

  Object.defineProperties(target, descriptors)

  return target
}
