'use strict'

/**
 * A more performant `Array.prototype.find`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {*}
 */
module.exports = function find (array, fn) {
  var i, j, value, result

  for (i = 0, j = array.length; i < j; i++) {
    value = array[i]
    result = fn(value)
    if (result) return value
  }

  return void 0
}
