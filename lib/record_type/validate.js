'use strict'

var find = require('../common/array/find')

var keys = require('../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var linkKey = keys.link
var inverseKey = keys.inverse
var isArrayKey = keys.isArray

var nativeTypes = [ String, Number, Boolean, Date, Object, Buffer ]
var plainObject = {}


/**
 * Given a hash of field definitions, validate that the definitions are in the
 * correct format.
 *
 * @param {Object} fields
 */
module.exports = function validate (fields) {
  var key

  if (typeof fields !== 'object')
    throw new TypeError('Type definition must be an object.')

  for (key in fields) validateField(fields[key], key)
}


/**
 * Parse a field definition.
 *
 * @param {Object} value
 * @param {String} key
 */
function validateField (value, key) {
  if (typeof value !== 'object' || value.constructor !== Object)
    throw new TypeError('The definition of "' + key + '" must be an object.')

  if (key === primaryKey)
    throw new Error('Can not define primary key "' + primaryKey + '".')

  if (key in plainObject)
    throw new Error('Can not define "' + key +
      '" which is in Object.prototype.')

  if (!value[typeKey] && !value[linkKey])
    throw new Error('The definition of "' + key + '" must contain either ' +
      'the "' + typeKey + '" or "' + linkKey + '" property.')

  if (value[typeKey] && value[linkKey])
    throw new Error('Can not define both "' + typeKey + '" and "' + linkKey +
      '" on "' + key + '".')

  if (value[typeKey]) {
    if (!find(nativeTypes, function (type) {
      return type === value[typeKey]
    }) && typeof value[typeKey] !== 'function')
      throw new Error('The "' + typeKey + '" on "' + key + '" is invalid.')

    if (typeof value[typeKey] === 'function' &&
      !find(nativeTypes, function (type) {
        return type === value[typeKey].prototype.constructor
      }))
      throw new Error('The "' + typeKey + '" on "' + key + '" must inherit ' +
        'from a valid native type.')

    if (value[inverseKey])
      throw new Error('The field "' + inverseKey + '" may not be defined ' +
        'on "' + key + '".')
  }

  if (value[linkKey]) {
    if (typeof value[linkKey] !== 'string')
      throw new TypeError('The "' + linkKey + '" on "' + key +
        '" must be a string.')

    if (value[inverseKey] && typeof value[inverseKey] !== 'string')
      throw new TypeError('The "' + inverseKey + '" on "' + key + '" ' +
        'must be a string.')
  }

  if (value[isArrayKey] && typeof value[isArrayKey] !== 'boolean')
    throw new TypeError('The key "' + isArrayKey + '" on "' + key + '" ' +
        'must be a boolean.')
}
