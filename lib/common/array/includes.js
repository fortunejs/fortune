'use strict'

/**
 * A more performant `Array.prototype.includes`.
 *
 * @param {*[]} array
 * @param {*} value
 * @return {Boolean}
 */
module.exports = function includes (array, value) {
  var i

  for (i = array.length; i--;)
    if (array[i] === value) return true

  return false
}
