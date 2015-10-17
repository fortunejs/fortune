/**
 * Define non-writable, non-configurable, enumerable properties.
 *
 * @param {Object} target
 * @param {Object} properties
 * @return {Object}
 */
module.exports = function defineEnumerable (target, properties) {
  if (properties === void 0) return target

  var descriptors = {}
  var keys = Object.keys(properties)
  var i, k

  for (i = keys.length; i--;) {
    k = keys[i]
    descriptors[k] = {
      value: properties[k],
      enumerable: true
    }
  }

  Object.defineProperties(target, descriptors)

  return target
}
