'use strict'

var common = require('../common')
var applyOptions = common.applyOptions

var applyUpdate = require('../../../common/apply_update')
var map = require('../../../common/array/map')
var includes = require('../../../common/array/includes')
var getGlobalObject = require('../../../common/global_object')

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
  function IndexedDBAdapter (properties) {
    var name

    Adapter.call(this, properties)
    name = this.options.name

    if (!name) this.options.name = 'fortune'
  }


  IndexedDBAdapter.prototype = Object.create(Adapter.prototype)


  IndexedDBAdapter.prototype.connect = function () {
    var self = this
    var Promise = self.Promise
    var primaryKey = self.keys.primary
    var recordTypes = self.recordTypes
    var typesArray = Object.keys(recordTypes)
    var name = self.options.name
    var request = indexedDB.open(name)

    return new Promise(function (resolve, reject) {
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        var db = self.db = event.target.result
        var needUpgrade = false
        var i

        for (i = typesArray.length; i--;)
          if (!includes(db.objectStoreNames, typesArray[i]))
            needUpgrade = true

        return needUpgrade ? reconnect(db, resolve, reject) : resolve()
      }
    })

    function handleUpgrade (event) {
      var db = event.target.result
      var i, type

      for (i = typesArray.length; i--;) {
        type = typesArray[i]
        if (!includes(db.objectStoreNames, type))
          db.createObjectStore(type, { keyPath: primaryKey })
      }

      map(db.objectStoreNames, function (type) {
        return !(type in recordTypes) ? db.deleteObjectStore(type) : null
      })
    }

    function reconnect (db, resolve, reject) {
      var request, version = (db.version || 1) + 1

      db.close()
      request = indexedDB.open(name, version)
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        self.db = event.target.result
        resolve()
      }
    }
  }


  IndexedDBAdapter.prototype.disconnect = function () {
    this.db.close()
    return Promise.resolve()
  }


  IndexedDBAdapter.prototype.create = function (type, records) {
    var self = this
    var Promise = self.Promise
    var db = this.db
    var ConflictError = this.errors.ConflictError
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)

    records = map(records, function (record) {
      return inputRecord.call(self, type, record)
    })

    return Promise.all(map(records, function (record) {
      return new Promise(function (resolve, reject) {
        var request = objectStore.add(record)
        request.onsuccess = resolve
        request.onerror = function (event) {
          if (event.target.error.name === 'ConstraintError')
            return reject(new ConflictError(
              'Unique key constraint violated.'))

          return reject(event.target.error)
        }
      })
    }))

    .then(function () {
      return map(records, function (record) {
        return outputRecord.call(self, type, record)
      })
    })
  }


  IndexedDBAdapter.prototype.find = function (type, ids, options) {
    var self = this
    var Promise = self.Promise
    var db = self.db
    var recordTypes = self.recordTypes
    var fields = recordTypes[type]
    var transaction = db.transaction(type, 'readonly')
    var objectStore = transaction.objectStore(type)
    var records = []
    var count = 0

    if (ids && !ids.length)
      return Adapter.prototype.find.call(self)

    return (ids ? new Promise(function (resolve, reject) {
      var counter = 0
      var i, id, request

      for (i = ids.length; i--;) {
        id = ids[i]
        request = objectStore.get(type + delimiter + id)
        request.onsuccess = verifyGet
        request.onerror = reject
      }

      function verifyGet (event) {
        var record = event.target.result
        if (record) {
          records.push(record)
          count++
        }
        counter++
        if (counter === ids.length) resolve(records)
      }
    }) : new Promise(function (resolve, reject) {
      var cursor = objectStore.openCursor()
      cursor.onsuccess = function (event) {
        var iterator = event.target.result
        if (iterator) {
          count++
          records.push(iterator.value)
          return iterator.continue()
        }
        resolve(records)
      }
      cursor.onerror = reject
    }))

    .then(function (records) {
      var result

      // Unfortunately, IndexedDB doesn't have native support for most of what
      // we want to query for, so we have to implement it ourselves.
      records = applyOptions(count, fields, records, options)
      result = map(records, function (record) {
        return outputRecord.call(self, type, record)
      })
      result.count = records.count

      return result
    })
  }


  IndexedDBAdapter.prototype.update = function (type, updates) {
    var self = this
    var Promise = self.Promise
    var db = this.db
    var primaryKey = this.keys.primary
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var found = 0
    var count = 0
    var done = 0

    if (!updates.length)
      return Adapter.prototype.update.call(self)

    return new Promise(function (resolve, reject) {
      var i, update, getRequest

      for (i = updates.length; i--;) {
        update = updates[i]
        getRequest = objectStore.get(
          type + delimiter + update[primaryKey])
        getRequest.onerror = reject
        getRequest.onsuccess = doUpdate(update)
      }

      function doUpdate (update) {
        return function (event) {
          var record = event.target.result
          var putRequest
          found++

          // If we found all records and there's nothing to update,
          // resolve with 0.
          if (!record)
            return found === updates.length && !count ? resolve(0) : null

          count++

          applyUpdate(record, update)

          putRequest = objectStore.put(record)
          putRequest.onerror = reject
          putRequest.onsuccess = function () {
            done++
            if (done === found) resolve(count)
          }
        }
      }
    })
  }


  IndexedDBAdapter.prototype.delete = function (type, ids) {
    var self = this
    var Promise = self.Promise
    var db = self.db
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)

    if (ids && !ids.length)
      return Adapter.prototype.delete.call(self)

    if (ids)
      return new Promise(function (resolve, reject) {
        var idCache = {}
        var count = 0
        var i, id, getRequest, deleteRequest

        // In order to ensure correct execution order, use 2 loops.

        for (i = ids.length; i--;) {
          id = ids[i]
          getRequest = objectStore.get(type + delimiter + id)
          getRequest.onsuccess = verifyGet(id)
          getRequest.onerror = reject
        }

        for (i = ids.length; i--;) {
          id = ids[i]
          deleteRequest = objectStore.delete(type + delimiter + id)
          deleteRequest.onsuccess = verifyDelete(id)
          deleteRequest.onerror = reject
        }

        function verifyDelete (id) {
          return function () {
            if (idCache[id]) count++
            if (count === Object.keys(idCache).length) resolve(count)
          }
        }

        function verifyGet (id) {
          return function (event) {
            if (event.target.result) idCache[id] = true
          }
        }
      })

    return new Promise(function (resolve, reject) {
      var count, countRequest, clearRequest

      countRequest = objectStore.count()
      countRequest.onsuccess = function (event) {
        count = event.target.result
      }
      countRequest.onerror = reject

      clearRequest = objectStore.clear()
      clearRequest.onsuccess = function () { resolve(count) }
      clearRequest.onerror = reject
    })
  }


  return IndexedDBAdapter
}
