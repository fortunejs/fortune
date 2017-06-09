'use strict'

// Modified base64 with "+" as "-" and "/" as "_".
var charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789-_'

var charsetLength = charset.length

// Should be a multiple of 3 to avoid padding characters.
var keyLength = 3 * 5

module.exports = function generateId () {
  var i, array = []

  for (i = 0; i < keyLength; i++)
    array.push(charset.charAt(Math.floor(Math.random() * charsetLength)))

  return array.join('')
}
