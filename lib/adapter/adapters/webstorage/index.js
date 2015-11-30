'use strict'

var map = require('../../../common/array/map')
var getGlobalObject = require('../../../common/global_object')
var memoryAdapter = require('../memory')

var constants = require('../../../common/constants')
var internalKey = constants.internal

var helpers = require('./helpers')
var inputRecord = helpers.inputRecord
var outputRecord = helpers.outputRecord

var delimiter = '__'


/**
 * Web Storage adapter. Available options:
 *
 * - `prefix`: Prefix for key names. Default: `fortune`.
 * - `storage`: name of storage global. Default: `localStorage`.
 */
module.exports = function (Adapter) {
  var MemoryAdapter = memoryAdapter(Adapter)

  function WebStorageAdapter (properties) {
    var storage, prefix

    Adapter.call(this, properties)
    storage = this.options.storage
    prefix = this.options.prefix

    if (!prefix) this.options.prefix = 'fortune'
    if (!storage) this.options.storage = 'localStorage'

    this.store = getGlobalObject()[this.options.storage]
  }

  Object.defineProperty(WebStorageAdapter, internalKey, { value: true })

  WebStorageAdapter.prototype = Object.create(MemoryAdapter.prototype)


  WebStorageAdapter.prototype.connect = function () {
    var self = this
    var store = self.store
    var prefix = self.options.prefix
    var primaryKey = self.keys.primary

    return MemoryAdapter.prototype.connect.call(self)
    .then(function () {
      var i, key, record, type, parts

      for (i = store.length; i--;) {
        key = store.key(i)
        parts = key.split(delimiter)

        if (parts[0] !== prefix) continue

        type = parts[1]
        record = store.getItem(key)

        if (record === null) continue

        record = outputRecord.call(self, type, JSON.parse(record))
        self.db[type][record[primaryKey]] = record
      }
    })
  }


  WebStorageAdapter.prototype.create = function (type, records) {
    var self = this
    var store = self.store
    var prefix = self.options.prefix
    var primaryKey = self.keys.primary

    return MemoryAdapter.prototype.create.call(self, type, records)
    .then(function (records) {
      var clones = map(records, function (record) {
        return inputRecord.call(self, type, record)
      })
      var i, record, key

      for (i = clones.length; i--;) {
        record = clones[i]
        key = prefix + delimiter + type + delimiter + record[primaryKey]
        store.setItem(key, JSON.stringify(record))
      }

      return records
    })
  }


  WebStorageAdapter.prototype.find = function (type, ids, options) {
    return MemoryAdapter.prototype.find.call(this, type, ids, options)
  }


  WebStorageAdapter.prototype.update = function (type, updates) {
    var self = this
    var store = self.store
    var db = self.db
    var prefix = self.options.prefix
    var primaryKey = self.keys.primary

    return MemoryAdapter.prototype.update.call(self, type, updates)
    .then(function (count) {
      var ids = map(updates, function (update) {
        return update[primaryKey]
      })
      var i, id, key, record

      for (i = ids.length; i--;) {
        id = ids[i]
        key = prefix + delimiter + type + delimiter + id
        record = db[type][id]
        if (!record) continue
        store.setItem(key,
          JSON.stringify(inputRecord.call(self, type, record)))
      }

      return count
    })
  }


  WebStorageAdapter.prototype.delete = function (type, ids) {
    var self = this
    var store = self.store
    var prefix = self.options.prefix

    return MemoryAdapter.prototype.delete.call(self, type, ids)
    .then(function (count) {
      var i, id, key, parts

      if (ids) for (i = ids.length; i--;) {
        id = ids[i]
        key = prefix + delimiter + type + delimiter + id
        store.removeItem(key)
      }
      else for (i = store.length; i--;) {
        key = store.key(i)
        parts = key.split(delimiter)

        if (parts[0] !== prefix) continue
        if (parts[1] !== type) continue

        store.removeItem(key)
      }

      return count
    })
  }


  return WebStorageAdapter
}
