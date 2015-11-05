'use strict'


/**
 * A fast clone function, which covers only the use case of Fortune.
 *
 * @param {*}
 * @return {*}
 */
module.exports = function clone (node) {
  var i, j, c, b, key, value, keys, isArray

  if (Array.isArray(node)) isArray = true
  else if (!node || Object.getPrototypeOf(node) !== Object.prototype)
    return node

  keys = Object.keys(node)
  c = isArray ? [] : {}

  for (i = 0, j = keys.length; i < j; i++) {
    key = keys[i]
    value = node[key]
    if (value &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value))
      c[key] = clone(value)
    else if (Buffer.isBuffer(value)) {
      b = new Buffer(value.length)
      value.copy(b)
      c[key] = b
    }
    else if (value instanceof Date)
      c[key] = new Date(value)
    else c[key] = value
  }

  return c
}
