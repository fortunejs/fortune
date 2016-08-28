'use strict'

// Local modules.
var Core = require('./core')
var promise = require('./common/promise')
var assign = require('./common/assign')

// Static exports.
var memory = require('./adapter/adapters/memory')
var indexedDB = require('./adapter/adapters/indexeddb')
var request = require('./net/websocket_request')
var client = require('./net/websocket_client')
var sync = require('./net/websocket_sync')

var adapters = {
  memory: memory,
  indexedDB: indexedDB
}

var net = {
  request: request,
  client: client,
  sync: sync
}


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune)) return new Fortune(recordTypes, options)

  if (options === void 0) options = {}

  // Try to use IndexedDB first, fall back to memory adapter.
  if (!('adapter' in options))
    options.adapter = [ indexedDB ]

  if (!('settings' in options))
    options.settings = {}

  if (!('enforceLinks' in options.settings))
    options.settings.enforceLinks = false

  return this.constructor(recordTypes, options)
}


Fortune.prototype = Object.create(Core.prototype)

assign(Fortune, Core)


// Assigning the Promise implementation.
Object.defineProperty(Fortune, 'Promise', {
  enumerable: true,
  get: function () {
    return promise.Promise
  },
  set: function (x) {
    promise.Promise = x
  }
})


// Assign useful static properties to the default export.
assign(Fortune, {
  adapters: adapters,
  net: net
})


module.exports = Fortune
