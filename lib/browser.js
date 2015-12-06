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

var adapters = {
  memory: memory,
  indexedDB: indexedDB
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
function Fortune (options) {
  if (!(this instanceof Fortune)) return new Fortune(options)
  if (options === void 0) options = {}

  // Try to use IndexedDB first, fall back to memory adapter.
  if (!('adapter' in options) &&
    hasIndexedDB && hasWebWorker && hasBlob && hasCreateObjectURL)
    options.adapter = { type: indexedDB }

  if (!('enforceLinks' in options))
    options.enforceLinks = false

  this.constructor(options)
}


Fortune.prototype = Object.create(Core.prototype)
assign(Fortune, Core)


Fortune.create = function (options) {
  console.warn('The "Fortune.create" method ' + // eslint-disable-line
    'will be deprecated in future versions.')
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
