'use strict'

var ceiling = Math.pow(2, 32)

module.exports = function generateId () {
  // Run two iterations, so 8 + 8 = 16 digit string.
  return generate() + generate()
}

// Make 8-digit hex string.
function generate () {
  return ('00000000' + Math.floor(Math.random() * ceiling).toString(16))
    .slice(-8)
}
