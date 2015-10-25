/**
 * A more performant `Array.prototype.find`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {*}
 */
function find (array, fn) {
  var i, j, k

  for (i = array.length; i--;) {
    j = array[i]
    k = fn(j)
    if (k) return j
  }
}


/**
 * A more performant `Array.prototype.includes`.
 *
 * @param {*[]} array
 * @param {*} value
 * @return {Boolean}
 */
function includes (array, value) {
  var i

  for (i = array.length; i--;)
    if (array[i] === value) return true

  return false
}


/**
 * Pull values from an array.
 *
 * @param {*[]} array
 * @param {*|*[]} values
 * @return {*[]}
 */
function pull (array, values) {
  var i, j, k = []

  if (!Array.isArray(values)) values = [ values ]

  for (i = array.length; i--;) {
    j = array[i]
    if (!includes(values, j)) k[k.length] = j
  }

  return k
}


/**
 * Return an array with unique values. Values must be primitive, and the array
 * may not be sparse.
 *
 * @param {Array}
 * @return {Array}
 */
function unique (a) {
  var seen = Object.create(null)
  var result = []
  var i, j, k

  for (i = 0, j = a.length; i < j; i++) {
    k = a[i]
    if (seen[k]) continue
    result.push(k)
    seen[k] = true
  }

  return result
}


module.exports = {
  find: find,
  includes: includes,
  pull: pull,
  unique: unique
}
