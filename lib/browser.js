'use strict'

// Local modules.
var Core = require('./core')
var promise = require('./common/promise')
var assign = require('./common/assign')
var defineEnumerable = require('./common/define_enumerable')
var getGlobalObject = require('./common/global_object')

// Static exports.
var memory = require('./adapter/adapters/memory')
var indexedDB = require('./adapter/adapters/indexeddb')
var request = require('./net/request')
var sync = require('./net/sync')

var adapters = {
  memory: memory,
  indexedDB: indexedDB
}

var net = {
  request: request,
  sync: sync
}

var globalObject = getGlobalObject()
var hasIndexedDB = 'indexedDB' in globalObject
var hasWebWorker = 'Worker' in globalObject
var hasBlob = 'Blob' in globalObject
var hasCreateObjectURL = 'URL' in globalObject && 'createObjectURL' in URL


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune)) return new Fortune(recordTypes, options)

  if (options === void 0) options = {}

  // Try to use IndexedDB first, fall back to memory adapter.
  if (!('adapter' in options) &&
    hasIndexedDB && hasWebWorker && hasBlob && hasCreateObjectURL)
    // Now that we're in here, need to check for private browsing modes.
    try {
      // This will fail synchronously if it's not supported.
      globalObject.indexedDB.open('').onsuccess = function (event) {
        event.target.result.close() // Close unused connection.
      }

      options.adapter = { type: indexedDB }
    }
    catch (error) {
       /* eslint-disable no-console */
      console.warn('IndexedDB capabilities detected, but a connection can ' +
        'not be opened due to browser security.')
      console.error(error)
      /* eslint-enable no-console */
    }

  if (!('settings' in options))
    options.settings = {}

  if (!('enforceLinks' in options.settings))
    options.settings.enforceLinks = false

  this.constructor(recordTypes, options)
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
defineEnumerable(Fortune, {
  adapters: adapters,
  net: net
})


module.exports = Fortune
