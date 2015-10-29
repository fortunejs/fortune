'use strict'

/**
 * Return an array with unique values. Values must be primitive, and the array
 * may not be sparse.
 *
 * @param {Array}
 * @return {Array}
 */
module.exports = function unique (a) {
  var seen = Object.create(null)
  var result = []
  var i, j, k

  for (i = 0, j = a.length; i < j; i++) {
    k = a[i]
    if (seen[k]) continue
    result[result.length] = k
    seen[k] = true
  }

  return result
}
