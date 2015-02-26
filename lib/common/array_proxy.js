/**
 * Proxy for Array.prototype.find.
 *
 * @param {Array} array
 * @param {Function} fn
 */
export function find (array, fn) {
  // Check for ES6 `Array.prototype.find`, or fall back to `core-js` method.
  return 'find' in Array.prototype ?
    array.find(fn) : Array.find(array, fn);
}
