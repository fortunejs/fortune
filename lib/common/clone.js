'use strict'


/**
 * A fast clone function, which covers only the use case of Fortune.
 *
 * @param {*}
 * @return {*}
 */
module.exports = function clone (node) {
  var i, j, c, key, value, keys, isArray

  if (Array.isArray(node)) isArray = true
  else if (!node || Object.getPrototypeOf(node) !== Object.prototype)
    return cloneValue(node)

  keys = Object.keys(node)
  c = isArray ? [] : {}

  for (i = 0, j = keys.length; i < j; i++) {
    key = keys[i]
    value = node[key]
    c[key] = value &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value) ? clone(value) : cloneValue(value)
  }

  return c
}


function cloneValue (value) {
  var buffer

  if (Buffer.isBuffer(value)) {
    buffer = new Buffer(value.length)
    value.copy(buffer)
    return buffer
  }

  if (value instanceof Date)
    return new Date(value)

  return value
}
