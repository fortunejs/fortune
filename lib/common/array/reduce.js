'use strict'

/**
 * A more performant `Array.prototype.reduce`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @param {*} [initialValue]
 * @return {Boolean}
 */
module.exports = function reduce (array, fn, initialValue) {
  var i, j, k = initialValue

  for (i = 0, j = array.length; i < j; i++)
    k = fn(k, array[i], i, array)

  return k
}
