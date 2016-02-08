'use strict'

var Adapter = require('./')
var errors = require('../common/errors')
var keys = require('../common/keys')
var message = require('../common/message')
var assign = require('../common/assign')
var constants = require('../common/constants')
var internalKey = constants.internal
var promise = require('../common/promise')


/**
 * A singleton for the adapter. For internal use.
 */
function AdapterSingleton (properties) {
  var CustomAdapter, input

  input = Array.isArray(properties.adapter) ?
    properties.adapter : [ properties.adapter ]

  if (typeof input[0] !== 'function')
    throw new TypeError('The adapter must be a function.')

  CustomAdapter = Adapter.prototype
    .isPrototypeOf(input[0].prototype) ? input[0] : input[0](Adapter)

  if (!Adapter.prototype.isPrototypeOf(CustomAdapter.prototype))
    throw new TypeError('The adapter must inherit the Adapter class.')

  return new CustomAdapter(assign({
    options: input[1] || {},
    recordTypes: properties.recordTypes,
    errors: errors,
    keys: keys,
    message: message,
    Promise: promise.Promise
  },
  // The built-in adapters have some optimizations for cloning objects which
  // are not needed for non-memory adapters.
  CustomAdapter[internalKey] ?
    { transforms: properties.transforms } :
    null
  ))
}


module.exports = AdapterSingleton
