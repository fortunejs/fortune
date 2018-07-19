'use strict'


/**
 * Pull primitive values from an array.
 *
 * @param {*[]} array
 * @param {*|*[]} values
 * @return {*[]}
 */
module.exports = function pull (array, values) {
  var hash = {}, clone = [], value
  var i, j

  if (Array.isArray(values))
    for (i = 0, j = values.length; i < j; i++)
      hash[values[i]] = true
  else hash[values] = true

  // Need to iterate backwards.
  for (i = array.length; i--;) {
    value = array[i]
    if (!hash.hasOwnProperty(value))
      // Unshift because it is iterating backwards.
      clone.unshift(value)
  }

  return clone
}
