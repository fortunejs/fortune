'use strict'

/**
 * A fast recursive equality check, which covers limited use cases.
 *
 * @param {Object}
 * @param {Object}
 * @return {Boolean}
 */
function deepEqual (a, b) {
  var key, value, compare, aLength = 0, bLength = 0

  // If they are the same object, don't need to go further.
  if (a === b) return true

  // Objects must be of the same type.
  if (a.prototype !== b.prototype) return false
  for (key in a) {
    aLength++
    value = a[key]
    compare = b[key]

    if (value instanceof Date) {
      if (!(compare instanceof Date) || value.getTime() !== compare.getTime())
        return false
      continue
    }

    if (value instanceof Buffer) {
      if (!(compare instanceof Buffer) || !value.equals(compare))
        return false
      continue
    }

    if (value instanceof Object) {
      if (!(compare instanceof Object) || !deepEqual(value, compare))
        return false
      continue
    }

    if (value !== compare) return false
  }

  for (key in b) bLength++

  // Keys must be of same length.
  return aLength === bLength
}


module.exports = deepEqual
