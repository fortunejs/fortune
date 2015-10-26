'use strict'

/**
 * A more performant `Array.prototype.find`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {*}
 */
module.exports = function find (array, fn) {
  var i, j, k

  for (i = array.length; i--;) {
    j = array[i]
    k = fn(j)
    if (k) return j
  }
}
