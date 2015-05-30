const hasFind = 'find' in Array.prototype
const hasIncludes = 'includes' in Array.prototype


/**
 * Proxy for `Array.prototype.find`.
 *
 * @param {*[]} array
 * @param {Function} fn
 */
export function find (array, fn) {
  // Check for ES6 `Array.prototype.find`, or fall back to
  // `core-js` polyfill.
  return hasFind ?
    array.find(fn) : Array.find(...arguments)
}


/**
 * Proxy for `Array.prototype.includes`.
 *
 * @param {*[]} array
 * @param {*} value
 */
export function includes (array, value) {
  // Check for ES6 `Array.prototype.includes`, or fall back to
  // `core-js` polyfill.
  return hasIncludes ?
    array.includes(value) : Array.includes(...arguments)
}
