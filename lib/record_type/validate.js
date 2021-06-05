'use strict'

var find = require('../common/array/find')
var map = require('../common/array/map')

var keys = require('../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var linkKey = keys.link
var inverseKey = keys.inverse
var isArrayKey = keys.isArray

var plainObject = {}
var nativeTypes = [ String, Number, Boolean, Date, Object, Buffer ]
var stringifiedTypes = map(nativeTypes, function (nativeType) {
  return nativeType.name && nativeType.name.toLowerCase()
})


/**
 * Given a hash of field definitions, validate that the definitions are in the
 * correct format.
 *
 * @param {Object} fields
 * @return {Object}
 */
module.exports = function validate (fields) {
  var key

  if (typeof fields !== 'object')
    throw new TypeError('Type definition must be an object.')

  for (key in fields) validateField(fields, key)

  return fields
}


/**
 * Parse a field definition.
 *
 * @param {Object} fields
 * @param {String} key
 */
function validateField (fields, key) {
  var value = fields[key] = castShorthand(fields[key])

  if (typeof value !== 'object')
    throw new TypeError('The definition of "' + key + '" must be an object.')

  if (key === primaryKey)
    throw new Error('Can not define primary key "' + primaryKey + '".')

  if (key in plainObject)
    throw new Error('Can not define field name "' + key +
      '" which is in Object.prototype.')

  if (!value[typeKey] && !value[linkKey])
    throw new Error('The definition of "' + key + '" must contain either ' +
      'the "' + typeKey + '" or "' + linkKey + '" property.')

  if (value[typeKey] && value[linkKey])
    throw new Error('Can not define both "' + typeKey + '" and "' + linkKey +
      '" on "' + key + '".')

  if (value[typeKey]) {
    if (typeof value[typeKey] === 'string')
      value[typeKey] = nativeTypes[
        stringifiedTypes.indexOf(value[typeKey].toLowerCase())]

    if (typeof value[typeKey] !== 'function')
      throw new Error('The "' + typeKey + '" on "' + key +
        '" must be a function.')

    if (!find(nativeTypes, function (type) {
      var hasMatch = type === value[typeKey] ||
        type.name === value[typeKey].name

      // In case this errors due to security sandboxing, just skip this check.
      if (!hasMatch)
        try {
          hasMatch = Object.create(value[typeKey]) instanceof type
        }
        catch (e) {
          hasMatch = true
        }

      return hasMatch
    }))
      throw new Error('The "' + typeKey + '" on "' + key + '" must be or ' +
        'inherit from a valid native type.')

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


/**
 * Cast shorthand definition to standard definition.
 *
 * @param {*} value
 * @return {Object}
 */
function castShorthand (value) {
  var obj

  if (typeof value === 'string') obj = { link: value }
  else if (typeof value === 'function') obj = { type: value }
  else if (Array.isArray(value)) {
    obj = {}

    if (value[1]) obj.inverse = value[1]
    else obj.isArray = true

    // Extract type or link.
    if (Array.isArray(value[0])) {
      obj.isArray = true
      value = value[0][0]
    }
    else value = value[0]

    if (typeof value === 'string') obj.link = value
    else if (typeof value === 'function') obj.type = value
  }
  else return value

  return obj
}
