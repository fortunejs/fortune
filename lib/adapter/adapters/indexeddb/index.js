'use strict'

var map = require('../../../common/array/map')
var includes = require('../../../common/array/includes')
var getGlobalObject = require('../../../common/global_object')
var memoryAdapter = require('../memory')

var constants = require('../../../common/constants')
var internalKey = constants.internal

var helpers = require('./helpers')
var inputRecord = helpers.inputRecord
var outputRecord = helpers.outputRecord
var delimiter = helpers.delimiter

var indexedDB = getGlobalObject().indexedDB


/**
 * IndexedDB adapter. Available options:
 *
 * - `name`: Name of the database to connect to. Default: `fortune`.
 */

module.exports = function (Adapter) {
  var MemoryAdapter = memoryAdapter(Adapter)

  function IndexedDBAdapter (properties) {
    var name

    Adapter.call(this, properties)
    name = this.options.name

    if (!name) this.options.name = 'fortune'
  }

  Object.defineProperty(IndexedDBAdapter, internalKey, { value: true })

  IndexedDBAdapter.prototype = Object.create(MemoryAdapter.prototype)


  IndexedDBAdapter.prototype.connect = function () {
    var self = this
    var Promise = self.Promise
    var primaryKey = self.keys.primary
    var recordTypes = self.recordTypes
    var typesArray = Object.keys(recordTypes)
    var name = self.options.name
    var request = indexedDB.open(name)
    var idb

    return new Promise(function (resolve, reject) {
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        var needUpgrade = false
        var i

        idb = self.idb = event.target.result

        for (i = typesArray.length; i--;)
          if (!includes(idb.objectStoreNames, typesArray[i]))
            needUpgrade = true

        return needUpgrade ? reconnect(idb, resolve, reject) : resolve()
      }
    })

    .then(function () {
      return Promise.all(map(typesArray, function (type) {
        return new Promise(function (resolve, reject) {
          var transaction = idb.transaction(type, 'readonly')
          var objectStore = transaction.objectStore(type)
          var cursor = objectStore.openCursor()
          var records = []

          cursor.onsuccess = function (event) {
            var iterator = event.target.result
            if (iterator) {
              records.push(iterator.value)
              return iterator.continue()
            }
            resolve(map(records, function (record) {
              return outputRecord.call(self, type, record)
            }))
          }
          cursor.onerror = reject
        })
      }))
    })

    .then(function (results) {
      var i, j, type

      self.db = {}
      for (i = 0, j = typesArray.length; i < j; i++) {
        type = typesArray[i]
        self.db[type] = results[i]
      }
    })

    function handleUpgrade (event) {
      var idb = event.target.result
      var i, type

      for (i = typesArray.length; i--;) {
        type = typesArray[i]
        if (!includes(idb.objectStoreNames, type))
          idb.createObjectStore(type, { keyPath: primaryKey })
      }

      map(idb.objectStoreNames, function (type) {
        return !(type in recordTypes) ? idb.deleteObjectStore(type) : null
      })
    }

    function reconnect (idb, resolve, reject) {
      var request, version = (idb.version || 1) + 1

      idb.close()
      request = indexedDB.open(name, version)
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        self.idb = event.target.result
        resolve()
      }
    }
  }


  IndexedDBAdapter.prototype.disconnect = function () {
    this.idb.close()
    return MemoryAdapter.prototype.disconnect.call(this)
  }


  IndexedDBAdapter.prototype.create = function (type, records) {
    var self = this
    var Promise = self.Promise
    var idb = self.idb
    var transaction = idb.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var result

    return MemoryAdapter.prototype.create.call(self, type, records)
    .then(function (records) {
      result = records

      return Promise.all(map(records, function (record) {
        return new Promise(function (resolve, reject) {
          var request = objectStore.add(inputRecord.call(self, type, record))
          request.onsuccess = resolve
          request.onerror = reject
        })
      }))

      .then(function () { return result })
    })
  }


  IndexedDBAdapter.prototype.find = function (type, ids, options) {
    return MemoryAdapter.prototype.find.call(this, type, ids, options)
  }


  IndexedDBAdapter.prototype.update = function (type, updates) {
    var self = this
    var Promise = self.Promise
    var db = self.db
    var idb = self.idb
    var primaryKey = self.keys.primary
    var transaction = idb.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)

    return MemoryAdapter.prototype.update.call(self, type, updates)
    .then(function (count) {
      return Promise.all(map(updates, function (update) {
        return new Promise(function (resolve, reject) {
          var record = db[type][update[primaryKey]]
          var putRequest

          if (!record) return resolve()

          putRequest = objectStore.put(inputRecord.call(self, type, record))
          putRequest.onerror = reject
          putRequest.onsuccess = resolve
        })
      }))
      .then(function () { return count })
    })
  }


  IndexedDBAdapter.prototype.delete = function (type, ids) {
    var self = this
    var Promise = self.Promise
    var db = self.db
    var idb = self.idb
    var transaction = idb.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)

    return MemoryAdapter.prototype.delete.call(self, type, ids)
    .then(function (count) {
      return (ids ? Promise.all(map(ids, function (id) {
        return new Promise(function (resolve, reject) {
          var record = db[type][id]
          var deleteRequest

          if (!record) return resolve()

          deleteRequest = objectStore.delete(type + delimiter + id)
          deleteRequest.onerror = reject
          deleteRequest.onsuccess = resolve
        })
      })) : new Promise(function (resolve, reject) {
        var clearRequest = objectStore.clear()
        clearRequest.onsuccess = resolve
        clearRequest.onerror = reject
      }))
      .then(function () { return count })
    })
  }

  return IndexedDBAdapter
}
