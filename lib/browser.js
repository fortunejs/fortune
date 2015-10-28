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
var webStorage = require('./adapter/adapters/webstorage')


var adapters = {
  memory: memory,
  indexedDB: indexedDB,
  webStorage: webStorage
}
var globalObject = getGlobalObject()
var hasIndexedDB = 'indexedDB' in globalObject
var hasWebStorage = 'localStorage' in globalObject


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (options) {
  if (!(this instanceof Fortune)) return new Fortune(options)
  if (options === void 0) options = {}

  // Try to use in order of priority: IndexedDB, WebStorage, memory adapter.
  if (!('adapter' in options))
    if (hasIndexedDB) options.adapter = { type: indexedDB }
    else if (hasWebStorage) options.adapter = { type: webStorage }

  if (!('enforceLinks' in options))
    options.enforceLinks = false

  this.constructor(options)
}


Fortune.prototype = Object.create(Core.prototype)
assign(Fortune, Core)


Fortune.create = function (options) {
  return new Fortune(options)
}


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
defineEnumerable(Fortune, { adapters: adapters })


module.exports = Fortune
