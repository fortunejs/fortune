'use strict'

/**
 * A fast recursive equality check, which covers limited use cases.
 *
 * @param {Object}
 * @param {Object}
 * @return {Boolean}
 */
function deepEqual (a, b) {
  var key, value, compare, keyLength, count

  // If they are the same object, don't need to go further.
  if (a === b) return true

  // Objects must be of the same type.
  if (a.prototype !== b.prototype) return false

  count = 0
  keyLength = Object.keys(b).length

  for (key in a) {
    count++
    value = a[key]
    compare = b[key]

    if (value instanceof Date && (!(compare instanceof Date) ||
      value.getTime() !== compare.getTime()))
      return false

    if (value instanceof Buffer && (!(compare instanceof Buffer) ||
      !value.equals(compare)))
      return false

    if (value instanceof Object && (!(compare instanceof Object) ||
      !deepEqual(value, compare)))
      return false

    if (value !== compare) return false
  }

  // Keys must be of same length.
  return count === keyLength
}


module.exports = deepEqual
