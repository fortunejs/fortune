'use strict'

module.exports = worker


// This function is somewhat special, it is run within a worker context.
function worker () {
  var indexedDB = self.indexedDB
  var db
  var methodMap = {
    connect: connect,
    disconnect: disconnect,
    create: create,
    update: update,
    delete: remove,
    deleteAll: removeAll
  }

  self.addEventListener('message', function (event) {
    var data = event.data
    var id = data.id
    var method = data.method

    methodMap[method](data, function (error, result, transfer) {
      if (error) {
        self.postMessage({
          id: id, error: '' + error
        })
        return
      }

      self.postMessage({
        id: id, result: result
      }, transfer)
    })
  })


  function connect (data, callback) {
    var request = indexedDB.open(data.name)
    var typesArray = data.typesArray

    request.onerror = errorConnection
    request.onupgradeneeded = handleUpgrade
    request.onsuccess = handleSuccess

    function handleSuccess (event) {
      var i, j

      db = event.target.result

      for (i = 0, j = typesArray.length; i < j; i++)
        if (!~Array.prototype.indexOf.call(
          db.objectStoreNames, typesArray[i])) {
          reconnect()
          return
        }

      loadRecords()
    }

    function handleUpgrade (event) {
      var i, j, type

      db = event.target.result

      for (i = 0, j = typesArray.length; i < j; i++) {
        type = typesArray[i]
        if (!~Array.prototype.indexOf.call(db.objectStoreNames, type))
          db.createObjectStore(type, { keyPath: primaryKey })
      }

      for (i = 0, j = db.objectStoreNames.length; i < j; i++) {
        type = db.objectStoreNames[i]
        if (!~Array.prototype.indexOf.call(typesArray, type))
          db.deleteObjectStore(type)
      }
    }

    function reconnect () {
      var version = (db.version || 1) + 1

      db.close()
      request = indexedDB.open(data.name, version)
      request.onerror = errorReconnection
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        db = event.target.result
        loadRecords(db)
      }
    }

    function loadRecords () {
      var counter = 0
      var payload = {}
      var transfer = []
      var i, j

      for (i = 0, j = typesArray.length; i < j; i++)
        loadType(typesArray[i])

      function loadType (type) {
        var transaction = db.transaction(type, 'readonly')
        var objectStore = transaction.objectStore(type)
        var cursor = objectStore.openCursor()

        payload[type] = []
        cursor.onsuccess = function (event) {
          var iterator = event.target.result
          if (iterator) {
            payload[type].push(iterator.value[dataKey])
            transfer.push(iterator.value[dataKey].buffer)
            iterator.continue()
            return
          }
          counter++
          if (counter === typesArray.length)
            callback(null, payload, transfer)
        }
        cursor.onerror = errorIteration
      }
    }

    function errorConnection () {
      callback('The database connection could not be established.')
    }

    function errorReconnection () {
      callback('An attempt to reconnect failed.')
    }

    function errorIteration () {
      callback('Failed to read record.')
    }
  }


  function disconnect () {
    db.close()
  }


  function create (data, callback) {
    var recordsLength = Object.keys(data.records).length
    var type = data.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var id, record, object, request, counter = 0

    for (id in data.records) {
      record = data.records[id]
      object = {}
      object[primaryKey] = type + delimiter + id
      object[dataKey] = record
      request = objectStore.add(object)
      request.onsuccess = check
      request.onerror = error
    }

    function check () {
      counter++
      if (counter === recordsLength) callback()
    }

    function error () {
      callback('A record could not be created.')
    }
  }


  function update (data, callback) {
    var recordsLength = Object.keys(data.records).length
    var type = data.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var id, record, object, request, counter = 0

    for (id in data.records) {
      record = data.records[id]
      object = {}
      object[primaryKey] = type + delimiter + id
      object[dataKey] = record
      request = objectStore.put(object)
      request.onsuccess = check
      request.onerror = error
    }

    function check () {
      counter++
      if (counter === recordsLength) callback()
    }

    function error () {
      callback('A record could not be updated.')
    }
  }


  function remove (data, callback) {
    var type = data.type
    var ids = data.ids
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var i, j, id, request, counter = 0

    for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      request = objectStore.delete(type + delimiter + id)
      request.onsuccess = check
      request.onerror = error
    }

    function check () {
      counter++
      if (counter === ids.length) callback()
    }

    function error () {
      callback('A record could not be deleted.')
    }
  }


  function removeAll (data, callback) {
    var type = data.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var request = objectStore.clear()
    request.onsuccess = function () { callback() }
    request.onerror = error

    function error () {
      callback('Not all records could be deleted.')
    }
  }
}
