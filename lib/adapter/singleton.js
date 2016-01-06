'use strict'

var Adapter = require('./')
var errors = require('../common/errors')
var keys = require('../common/keys')
var message = require('../common/message')
var constants = require('../common/constants')
var internalKey = constants.internal
var promise = require('../common/promise')


/**
 * A singleton for the adapter. For internal use.
 */
function AdapterSingleton (properties) {
  var type = properties.adapter.type
  var CustomAdapter, obj

  this.constructor(properties)

  if (typeof type !== 'function')
    throw new TypeError('The adapter must be a function or class.')

  CustomAdapter = Adapter.prototype
    .isPrototypeOf(type.prototype) ? type : type(Adapter)

  if (!Adapter.prototype.isPrototypeOf(CustomAdapter.prototype))
    throw new TypeError('The adapter must be a class that extends Adapter.')

  obj = {
    options: properties.adapter.options || {},
    recordTypes: properties.recordTypes,
    errors: errors,
    keys: keys,
    message: message,
    Promise: promise.Promise
  }

  // The built-in adapters have some optimizations for cloning objects which
  // are not needed for non-memory adapters.
  if (CustomAdapter[internalKey])
    obj.transforms = properties.transforms

  return new CustomAdapter(obj)
}


AdapterSingleton.prototype = Object.create(Adapter.prototype)


module.exports = AdapterSingleton
