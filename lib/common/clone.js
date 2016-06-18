'use strict'

/**
 * A fast deep clone function, which covers only JSON-serializable objects.
 *
 * @param {*}
 * @return {*}
 */
module.exports = function deepClone (node) {
  var clone, key, value, isArray

  if (Array.isArray(node)) isArray = true
  else if (Object.getPrototypeOf(node) !== Object.prototype)
    return node

  clone = isArray ? [] : {}

  for (key in node) {
    value = node[key]
    clone[key] = value !== null &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value) ? deepClone(value) : value
  }

  return clone
}
