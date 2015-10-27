'use strict'

/**
 * A more performant `Array.prototype.filter`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {Boolean}
 */
module.exports = function filter (array, fn) {
  var i, j, k = [], l = 0

  for (i = 0, j = array.length; i < j; i++)
    if (fn(array[i], i, array))
      k[l++] = array[i]

  return k
}
