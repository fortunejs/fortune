'use strict'

var msgpack = require('msgpack-lite')
var reduce = require('../../../common/array/reduce')
var assign = require('../../../common/assign')
var memoryAdapter = require('../memory')

var common = require('../common')
var generateId = common.generateId

var constants = require('../../../common/constants')
var internalKey = constants.internal
var primaryKey = constants.primary

var worker = require('./worker')
var helpers = require('./helpers')
var inputRecord = helpers.inputRecord
var outputRecord = helpers.outputRecord
var delimiter = helpers.delimiter


/**
 * IndexedDB adapter. Available options:
 *
 * - `name`: Name of the database to connect to. Default: `fortune`.
 */
module.exports = function (Adapter) {
  var MemoryAdapter = memoryAdapter(Adapter)

  function IndexedDBAdapter (properties) {
    MemoryAdapter.call(this, properties)
    if (!this.options.name) this.options.name = 'fortune'
  }

  Object.defineProperty(IndexedDBAdapter, internalKey, { value: true })

  IndexedDBAdapter.prototype = Object.create(MemoryAdapter.prototype)


  IndexedDBAdapter.prototype.connect = function () {
    var self = this
    var Promise = self.Promise
    var typesArray = Object.keys(self.recordTypes)
    var name = self.options.name
    var id = generateId()

    return MemoryAdapter.prototype.connect.call(self)
    .then(function () {
      return new Promise(function (resolve, reject) {
        var hasIndexedDB = 'indexedDB' in window
        var hasWebWorker = 'Worker' in window
        var hasBlob = 'Blob' in window
        var hasCreateObjectURL = 'URL' in window && 'createObjectURL' in URL
        var blob, objectURL, worker

        if (hasIndexedDB && hasWebWorker && hasBlob && hasCreateObjectURL)
          // Now that we're in here, need to check for private browsing modes.
          try {
            // This will fail synchronously if it's not supported.
            indexedDB.open('').onsuccess = function (event) {
              event.target.result.close() // Close unused connection.
            }
          }
          catch (error) {
            return reject(new Error('IndexedDB capabilities detected, but a ' +
              'connection could not be opened due to browser security.'))
          }
        else return reject(new Error('IndexedDB pre-requisites not met.'))

        // Need to check for IndexedDB support within Web Worker.
        blob = new Blob([
          'self.postMessage(Boolean(self.indexedDB))'
        ], { type: 'text/javascript' })
        objectURL = URL.createObjectURL(blob)
        worker = new Worker(objectURL)

        worker.onmessage = function (message) {
          return message.data ? resolve() :
            reject(new Error('No IndexedDB support in Web Worker.'))
        }

        return null
      })
      // After this point, no more checks.
      .then(function () {
        return new Promise(function (resolve, reject) {
          var script, blob, objectURL

          script = [
            'var primaryKey = "' + primaryKey + '"',
            'var delimiter = "' + delimiter + '"',
            'var dataKey = "__data"',
            '(' + worker.toString() + ')()'
          ].join(';')
          blob = new Blob([ script ], { type: 'text/javascript' })
          objectURL = URL.createObjectURL(blob)

          self.worker = new Worker(objectURL)
          self.worker.addEventListener('message', listener)
          self.worker.postMessage({
            id: id, method: 'connect',
            name: name, typesArray: typesArray
          })

          function listener (event) {
            var data = event.data
            var result = data.result
            var type

            if (data.id !== id) return null
            if (data.error) return reject(new Error(data.error))

            self.worker.removeEventListener('message', listener)

            for (type in result)
              self.db[type] = reducer(type, result[type])

            return resolve()
          }
        })
      })
      // Warning and fallback to memory adapter.
      .catch(function (error) {
        console.warn(error.message) // eslint-disable-line no-console

        // Assign instance methods of the memory adapter.
        assign(self, MemoryAdapter.prototype)
      })
    })

    // Populating memory database with results from IndexedDB.
    function reducer (type, records) {
      return reduce(records, function (hash, record) {
        record = outputRecord.call(self, type, msgpack.decode(record))
        hash[record[primaryKey]] = record
        return hash
      }, {})
    }
  }


  IndexedDBAdapter.prototype.disconnect = function () {
    this.worker.postMessage({ method: 'disconnect' })
    return MemoryAdapter.prototype.disconnect.call(this)
  }


  IndexedDBAdapter.prototype.create = function (type, records) {
    var self = this
    var Promise = self.Promise

    return MemoryAdapter.prototype.create.call(self, type, records)
    .then(function (records) {
      return records.length ? new Promise(function (resolve, reject) {
        var id = generateId()
        var transfer = []

        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, method: 'create', type: type,
          records: reduce(records, function (hash, record) {
            var data = msgpack.encode(inputRecord.call(self, type, record))
            transfer.push(data.buffer)
            hash[record[primaryKey]] = data
            return hash
          }, {})
        }, transfer)

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(new Error(data.error))

          self.worker.removeEventListener('message', listener)
          return resolve(records)
        }
      }) : records
    })
  }


  IndexedDBAdapter.prototype.find = function (type, ids, options) {
    return MemoryAdapter.prototype.find.call(this, type, ids, options)
  }


  IndexedDBAdapter.prototype.update = function (type, updates) {
    var self = this
    var Promise = self.Promise
    var db = self.db
    var id = generateId()

    return MemoryAdapter.prototype.update.call(self, type, updates)
    .then(function (count) {
      return count ? new Promise(function (resolve, reject) {
        var i, j, record, records = [], transfer = []

        for (i = 0, j = updates.length; i < j; i++) {
          record = db[type][updates[i][primaryKey]]
          if (!record) continue
          records.push(record)
        }

        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, method: 'update', type: type,
          records: reduce(records, function (hash, record) {
            var data = msgpack.encode(inputRecord.call(self, type, record))
            transfer.push(data.buffer)
            hash[record[primaryKey]] = data
            return hash
          }, {})
        }, transfer)

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(new Error(data.error))

          self.worker.removeEventListener('message', listener)

          return resolve(count)
        }
      }) : count
    })
  }


  IndexedDBAdapter.prototype.delete = function (type, ids) {
    var self = this
    var Promise = self.Promise
    var id = generateId()

    return MemoryAdapter.prototype.delete.call(self, type, ids)
    .then(function (count) {
      return count ? new Promise(function (resolve, reject) {
        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, method: ids ? 'delete' : 'deleteAll',
          type: type, ids: ids
        })

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(new Error(data.error))

          self.worker.removeEventListener('message', listener)

          return resolve(count)
        }
      }) : count
    })
  }

  return IndexedDBAdapter
}
