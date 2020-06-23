'use strict'

var applyUpdate = require('../../../common/apply_update')
var map = require('../../../common/array/map')
var promise = require('../../../common/promise')

var common = require('../common')
var applyOptions = common.applyOptions

var helpers = require('./helpers')
var inputRecord = helpers.inputRecord
var outputRecord = helpers.outputRecord


/**
 * Memory adapter.
 */
module.exports = function (Adapter) {
  function MemoryAdapter (properties) {
    Adapter.call(this, properties)
    if (!this.options) this.options = {}
    if (!('recordsPerType' in this.options))
      this.options.recordsPerType = 1000
  }

  MemoryAdapter.prototype = new Adapter()

  MemoryAdapter.prototype.connect = function () {
    var Promise = promise.Promise
    var recordTypes = this.recordTypes
    var type

    this.db = {}

    for (type in recordTypes)
      this.db[type] = {}

    return Promise.resolve()
  }


  MemoryAdapter.prototype.disconnect = function () {
    var Promise = promise.Promise

    delete this.db
    return Promise.resolve()
  }


  MemoryAdapter.prototype.find = function (type, ids, options, meta) {
    var Promise = promise.Promise
    var self = this
    var recordTypes = self.recordTypes
    var fields = recordTypes[type]
    var collection = self.db[type]

    var records = []
    var i, j, id, record

    if (ids && !ids.length) return Adapter.prototype.find.call(self)

    if (ids) for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      if (collection.hasOwnProperty(id)) {
        record = collection[id]

        // LRU update.
        delete collection[id]
        collection[id] = record

        records.push(outputRecord.call(self, type, record))
      }
    }

    else for (id in collection)
      records.push(outputRecord.call(self, type, collection[id]))

    return Promise
      .resolve(applyOptions(fields, records, options, meta, self, type))
  }


  MemoryAdapter.prototype.create = function (type, records, meta) {
    var Promise = promise.Promise
    var self = this
    var message = self.message
    var recordsPerType = self.options.recordsPerType
    var primaryKey = self.keys.primary
    var ConflictError = self.errors.ConflictError
    var collection = self.db[type]
    var i, j, record, id, ids, language

    if (!meta) meta = {}
    language = meta.language

    records = map(records, function (record) {
      return inputRecord.call(self, type, record)
    })

    // First check for collisions.
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      id = record[primaryKey]

      if (collection.hasOwnProperty(id))
        return Promise.reject(new ConflictError(
          message('RecordExists', language, { id: id })))
    }

    // Then save it to memory.
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      collection[record[primaryKey]] = record
    }

    // Clear least recently used records.
    if (recordsPerType) {
      ids = Object.keys(collection)

      if (ids.length > recordsPerType) {
        ids = ids.slice(0, ids.length - recordsPerType)

        for (i = 0, j = ids.length; i < j; i++)
          delete collection[ids[i]]
      }
    }

    return Promise.resolve(map(records, function (record) {
      return outputRecord.call(self, type, record)
    }))
  }


  MemoryAdapter.prototype.update = function (type, updates) {
    var Promise = promise.Promise
    var self = this
    var primaryKey = self.keys.primary
    var collection = self.db[type]
    var count = 0
    var i, j, update, id, record

    if (!updates.length) return Adapter.prototype.update.call(self)

    for (i = 0, j = updates.length; i < j; i++) {
      update = updates[i]
      id = update[primaryKey]
      record = collection[id]

      if (!record) continue

      count++
      record = outputRecord.call(self, type, record)

      applyUpdate(record, update)

      // LRU update.
      delete collection[id]

      collection[id] = inputRecord.call(self, type, record)
    }

    return Promise.resolve(count)
  }


  MemoryAdapter.prototype.delete = function (type, ids) {
    var Promise = promise.Promise
    var collection = this.db[type]
    var count = 0
    var i, j, id

    if (ids && !ids.length) return Adapter.prototype.delete.call(this)

    if (ids) for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      if (collection[id]) {
        delete collection[id]
        count++
      }
    }

    else for (id in collection) {
      delete collection[id]
      count++
    }

    return Promise.resolve(count)
  }

  // Expose utility functions.
  MemoryAdapter.common = common

  // Expose features for introspection.
  MemoryAdapter.features = {
    logicalOperators: true
  }

  return MemoryAdapter
}
