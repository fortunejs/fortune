'use strict'
// TODO: split this file into multiple modules.


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
 * A more performant `Array.prototype.map`.
 *
 * @param {*[]} array
 * @param {*} value
 * @return {Boolean}
 */
function map (array, fn) {
  var i, j, k = [], l = 0

  for (i = 0, j = array.length; i < j; i++)
    k[l++] = fn(array[i], i, array)

  return k
}


/**
 * Pull values from an array.
 *
 * @param {*[]} array
 * @param {*|*[]} values
 * @return {*[]}
 */
function pull (array, values) {
  var i, j, k = [], l = 0, m

  if (!Array.isArray(values)) values = [ values ]

  for (i = 0, m = array.length; i < m; i++) {
    j = array[i]
    if (!includes(values, j))
      k[l++] = j
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
  map: map,
  pull: pull,
  unique: unique
}
