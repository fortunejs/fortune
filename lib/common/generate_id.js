'use strict'

module.exports = function generateId () {
  return Date.now() + '-' +
    ('00000000' + Math.floor(Math.random() * Math.pow(2, 32)).toString(16))
    .slice(-8)
}
