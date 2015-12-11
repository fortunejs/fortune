'use strict'

module.exports = worker


// This function is somewhat special, it is run within a worker context.
function worker () {
  var indexedDB = self.indexedDB
  var db
  var typeMap = {
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
    var type = data.type
    var payload = data.payload

    typeMap[type](payload, function (error, result) {
      if (error) return self.postMessage({
        id: id, error: error.toString()
      })

      self.postMessage({
        id: id, result: JSON.stringify(result)
      })
    })
  })


  function connect (payload, callback) {
    var request = indexedDB.open(payload.name)
    var typesArray = payload.typesArray

    request.onerror = callback
    request.onupgradeneeded = handleUpgrade
    request.onsuccess = handleSuccess

    function handleSuccess (event) {
      var i

      db = event.target.result

      for (i = typesArray.length; i--;)
        if (!includes(db.objectStoreNames, typesArray[i]))
          return reconnect()

      loadRecords()
    }

    function handleUpgrade (event) {
      var i, type

      db = event.target.result

      for (i = typesArray.length; i--;) {
        type = typesArray[i]
        if (!includes(db.objectStoreNames, type))
          db.createObjectStore(type, { keyPath: primaryKey })
      }

      for (i = db.objectStoreNames.length; i--;) {
        type = db.objectStoreNames[i]
        if (!includes(typesArray, type))
          db.deleteObjectStore(type)
      }
    }

    function reconnect () {
      var version = (db.version || 1) + 1

      db.close()
      request = indexedDB.open(name, version)
      request.onerror = callback
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = function (event) {
        db = event.target.result
        loadRecords(db)
      }
    }

    function loadRecords () {
      var counter = 0
      var payload = {}
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
            payload[type].push(JSON.parse(iterator.value[dataKey]))
            return iterator.continue()
          }
          counter++
          if (counter === typesArray.length)
            return callback(null, payload)
        }
        cursor.onerror = callback
      }
    }
  }


  function disconnect () {
    db.close()
  }


  function create (payload, callback) {
    var records = JSON.parse(payload.records)
    var type = payload.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var i, j, record, clone, request, counter = 0

    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      clone = {}
      clone[primaryKey] = record[primaryKey]
      clone[dataKey] = JSON.stringify(record)
      request = objectStore.add(clone)
      request.onsuccess = check
      request.onerror = callback
    }

    function check () {
      counter++
      if (counter === records.length) callback()
    }
  }


  function update (payload, callback) {
    var records = JSON.parse(payload.records)
    var type = payload.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var i, j, record, clone, request, counter = 0

    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      clone = {}
      clone[primaryKey] = record[primaryKey]
      clone[dataKey] = JSON.stringify(record)
      request = objectStore.put(clone)
      request.onsuccess = check
      request.onerror = callback
    }

    function check () {
      counter++
      if (counter === records.length) callback()
    }
  }


  function remove (payload, callback) {
    var type = payload.type
    var ids = payload.ids
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var i, j, id, request, counter = 0

    for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      request = objectStore.delete(type + delimiter + id)
      request.onsuccess = check
      request.onerror = callback
    }

    function check () {
      counter++
      if (counter === ids.length) callback()
    }
  }


  function removeAll (payload, callback) {
    var type = payload.type
    var transaction = db.transaction(type, 'readwrite')
    var objectStore = transaction.objectStore(type)
    var request = objectStore.clear()
    request.onsuccess = function () { callback() }
    request.onerror = callback
  }
}
