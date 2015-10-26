'use strict'

/**
 * Like `Object.assign`, but faster and more restricted in what it does.
 *
 * @param {Object} target
 * @param {Object} properties
 * @return {Object}
 */
module.exports = function assign (target, properties) {
  var keys, i, j

  if (!properties) return target

  keys = Object.keys(properties)

  for (i = keys.length; i--;) {
    j = keys[i]
    target[j] = properties[j]
  }

  return target
}
