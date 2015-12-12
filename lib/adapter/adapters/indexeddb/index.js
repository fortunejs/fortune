'use strict'

var map = require('../../../common/array/map')
var reduce = require('../../../common/array/reduce')
var includes = require('../../../common/array/includes')
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
  var script = [
    'var primaryKey = "' + primaryKey + '"',
    'var delimiter = "' + delimiter + '"',
    'var dataKey = "__data"',
    '(' + worker.toString() + ')()',
    includes.toString()
  ].join(';')
  var blob = new Blob([ script ], { type: 'text/javascript' })
  var objectURL = URL.createObjectURL(blob)

  function IndexedDBAdapter (properties) {
    Adapter.call(this, properties)
    if (!this.options.name) this.options.name = 'fortune'
    this.worker = new Worker(objectURL)
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
        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, type: 'connect',
          payload: { name: name, typesArray: typesArray }
        })

        function listener (event) {
          var data = event.data
          var result = JSON.parse(data.result)
          var i, j, type, types

          if (data.id !== id) return null
          if (data.error) return reject(data.error)

          self.worker.removeEventListener('message', listener)

          types = Object.keys(result)
          for (i = 0, j = types.length; i < j; i++) {
            type = types[i]
            self.db[type] = reducer(type, result[type])
          }

          return resolve()
        }
      })
    })

    function reducer (type, records) {
      return reduce(records, function (hash, record) {
        record = outputRecord.call(self, type, record)
        hash[record[primaryKey]] = record
        return hash
      }, {})
    }
  }


  IndexedDBAdapter.prototype.disconnect = function () {
    this.worker.postMessage({ type: 'disconnect' })
    return MemoryAdapter.prototype.disconnect.call(this)
  }


  IndexedDBAdapter.prototype.create = function (type, records) {
    var self = this
    var Promise = self.Promise
    var id = generateId()

    return MemoryAdapter.prototype.create.call(self, type, records)
    .then(function (records) {
      return records.length ? new Promise(function (resolve, reject) {
        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, type: 'create',
          payload: {
            type: type,
            records: JSON.stringify(map(records, function (record) {
              return inputRecord.call(self, type, record)
            }))
          }
        })

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(data.error)

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
        var i, j, record, records = []

        for (i = 0, j = updates.length; i < j; i++) {
          record = db[type][updates[i][primaryKey]]
          if (!record) continue
          records.push(inputRecord.call(self, type, record))
        }

        self.worker.addEventListener('message', listener)
        self.worker.postMessage({
          id: id, type: 'update',
          payload: { type: type, records: JSON.stringify(records) }
        })

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(data.error)

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
          id: id, type: ids ? 'delete' : 'deleteAll',
          payload: { type: type, ids: ids }
        })

        function listener (event) {
          var data = event.data

          if (data.id !== id) return null
          if (data.error) return reject(data.error)

          self.worker.removeEventListener('message', listener)

          return resolve(count)
        }
      }) : count
    })
  }

  return IndexedDBAdapter
}
