'use strict'

/**
 * A fast deep clone function, which covers mostly serializable objects.
 *
 * @param {*}
 * @return {*}
 */
module.exports = function clone (input) {
  var output, key, value, isArray

  if (Array.isArray(input)) isArray = true
  else if (input == null || Object.getPrototypeOf(input) !== Object.prototype)
    return input

  output = isArray ? [] : {}

  for (key in input) {
    value = input[key]
    output[key] = value !== null && value !== undefined &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value) ? clone(value) : value
  }

  return output
}
