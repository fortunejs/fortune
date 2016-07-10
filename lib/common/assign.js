'use strict'

/**
 * Like `Object.assign`, but faster and more restricted in what it does.
 *
 * @param {Object} target
 * @return {Object}
 */
module.exports = function assign (target) {
  var i, j, key, source

  for (i = 1, j = arguments.length; i < j; i++) {
    source = arguments[i]

    if (source == null) continue

    for (key in source)
      target[key] = source[key]
  }

  return target
}
