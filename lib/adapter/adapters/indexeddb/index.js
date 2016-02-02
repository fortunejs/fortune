'use strict'

var msgpack = require('msgpack-lite')
var reduce = require('../../../common/array/reduce')
var includes = require('../../../common/array/includes')
var memoryAdapter = require('../memory')

var common = require('../common')
var generateId = common.generateId

var constants = require('../../../common/constants')
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
