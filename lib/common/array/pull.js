'use strict'

var includes = require('./includes')

/**
 * Pull values from an array.
 *
 * @param {*[]} array
 * @param {*|*[]} values
 * @return {*[]}
 */
module.exports = function pull (array, values) {
  var i, j, k = [], l = 0, m

  if (!Array.isArray(values)) values = [ values ]

  for (i = 0, m = array.length; i < m; i++) {
    j = array[i]
    if (!includes(values, j))
      k[l++] = j
  }

  return k
}
