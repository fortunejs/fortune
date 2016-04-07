'use strict'

/**
 * A more performant `Array.prototype.includes`.
 *
 * @param {*[]} array
 * @param {*} value
 * @return {Boolean}
 */
module.exports = function includes (array, value) {
  var i, j

  for (i = 0, j = array.length; i < j; i++)
    if (array[i] === value) return true

  return false
}
