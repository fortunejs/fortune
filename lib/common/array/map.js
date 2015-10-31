'use strict'

/**
 * A more performant `Array.prototype.map`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {Boolean}
 */
module.exports = function map (array, fn) {
  var i, j, k = [], l = 0

  for (i = 0, j = array.length; i < j; i++)
    k[l++] = fn(array[i], i, array)

  return k
}
