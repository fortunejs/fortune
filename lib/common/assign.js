/**
 * Like `Object.assign`, but faster and more restricted in what it does.
 *
 * @param {Object} target
 * @param {Object} properties
 * @return {Object}
 */
module.exports = function assign (target, properties) {
  if (!properties) return target

  var keys = Object.keys(properties)
  var i, k

  for (i = keys.length; i--;) {
    k = keys[i]
    target[k] = properties[k]
  }

  return target
}
