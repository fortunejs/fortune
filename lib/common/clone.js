'use strict'

module.exports = {
  deep: deepClone,
  shallow: shallowClone
}


/**
 * A fast deep clone function, which covers only JSON-serializable objects.
 *
 * @param {*}
 * @return {*}
 */
function deepClone (node) {
  var i, j, clone, key, value, keys, isArray

  if (Array.isArray(node)) isArray = true
  else if (!node || Object.getPrototypeOf(node) !== Object.prototype)
    return node

  keys = Object.keys(node)
  clone = isArray ? [] : {}

  for (i = 0, j = keys.length; i < j; i++) {
    key = keys[i]
    value = node[key]
    clone[key] = value &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value) ? deepClone(value) : value
  }

  return clone
}


/**
 * A shallow clone function, works on objects only, not arrays.
 *
 * @param {Object}
 * @return {Object}
 */
function shallowClone (object) {
  var keys = Object.keys(object)
  var clone = {}
  var i, j, key

  for (i = 0, j = keys.length; i < j; i++) {
    key = keys[i]
    clone[key] = object[key]
  }

  return clone
}
