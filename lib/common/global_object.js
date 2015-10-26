'use strict'

// Return the global object. Thanks Axel Rauschmayer.
// https://gist.github.com/rauschma/1bff02da66472f555c75
module.exports = function getGlobalObject () {
  // Workers don’t have `window`, only `self`.
  if (typeof self !== 'undefined') return self // eslint-disable-line no-undef

  // Node.js detection.
  if (typeof global !== 'undefined') return global

  // Not all environments allow eval and Function. Use only as a last resort:
  return Function('return this')() // eslint-disable-line no-new-func
}
