/**
 * Proxy for `Array.prototype.find`.
 *
 * @param {Array} array
 * @param {Function} fn
 */
export function find (array, fn) {
  // Check for ES6 `Array.prototype.find`, or fall back to
  // `core-js` polyfill.
  return 'find' in Array.prototype ?
    array.find(fn) : Array.find(...arguments)
}


/**
 * Proxy for `Array.prototype.includes`.
 *
 * @param {Array} array
 * @param {*} value
 */
export function includes (array, value) {
  // Check for ES6 `Array.prototype.includes`, or fall back to
  // `core-js` polyfill.
  return 'includes' in Array.prototype ?
    array.includes(value) : Array.includes(...arguments)
}
