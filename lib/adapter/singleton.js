'use strict'

var Adapter = require('./')
var errors = require('../common/errors')
var keys = require('../common/keys')


/**
 * A singleton for the adapter. For internal use.
 */
function AdapterSingleton (properties) {
  var type = properties.adapter.type
  var CustomAdapter

  this.constructor(properties)

  if (typeof type !== 'function')
    throw new TypeError('The adapter must be a function or class.')

  CustomAdapter = Adapter.prototype
    .isPrototypeOf(type.prototype) ? type : type(Adapter)

  if (!Adapter.prototype.isPrototypeOf(CustomAdapter.prototype))
    throw new TypeError('The adapter must be a class that extends Adapter.')

  return new CustomAdapter({
    options: properties.adapter.options || {},
    recordTypes: properties.recordTypes,
    errors: errors,
    keys: keys
  })
}


AdapterSingleton.prototype = Object.create(Adapter.prototype)


module.exports = AdapterSingleton
