import { applyOptions } from '../common'
import applyUpdate from '../../../common/apply_update'
import getGlobalObject from '../../../common/global_object'
import { inputRecord, outputRecord, delimiter } from './helpers'


const { indexedDB } = getGlobalObject()


/**
 * IndexedDB adapter. Available options:
 *
 * - `name`: Name of the database to connect to. Default: `fortune`.
 */
export default Adapter => class IndexedDBAdapter extends Adapter {

  connect () {
    const { recordTypes, options, keys: { primary: primaryKey } } = this
    const name = options.name || 'fortune'
    const request = indexedDB.open(name)

    const handleUpgrade = event => {
      const db = event.target.result

      for (let type in recordTypes)
        if (!~Array.prototype.indexOf.call(db.objectStoreNames, type))
          db.createObjectStore(type, { keyPath: primaryKey })

      Array.prototype.forEach.call(db.objectStoreNames, type =>
        !(type in recordTypes) ? db.deleteObjectStore(type) : null)
    }

    const reconnect = (db, resolve, reject) => {
      const version = (db.version || 1) + 1
      db.close()

      const request = indexedDB.open(name, version)
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = event => {
        this.db = event.target.result
        return resolve()
      }
    }

    return new Promise((resolve, reject) => {
      request.onerror = reject
      request.onupgradeneeded = handleUpgrade
      request.onsuccess = event => {
        const db = this.db = event.target.result
        let needUpgrade = false

        for (let type in recordTypes)
          if (!~Array.prototype.indexOf.call(db.objectStoreNames, type))
            needUpgrade = true

        return needUpgrade ? reconnect(db, resolve, reject) : resolve()
      }
    })
  }


  disconnect () {
    this.db.close()
    return Promise.resolve()
  }


  create (type, records) {
    records = records.map(inputRecord.bind(this, type))

    const { db, errors: { ConflictError } } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)

    return Promise.all(records.map(record => new Promise((resolve, reject) => {
      const request = objectStore.add(record)
      request.onsuccess = resolve
      request.onerror = event => {
        if (event.target.error.name === 'ConstraintError')
          return reject(new ConflictError(
            `Unique key constraint violated.`))

        return reject(event.target.error)
      }
    })))

    .then(() => records.map(outputRecord.bind(this, type)))
  }


  find (type, ids, options) {
    if (ids && !ids.length) return super.find()

    const { db, recordTypes } = this
    const fields = recordTypes[type]
    const transaction = db.transaction(type, 'readonly')
    const objectStore = transaction.objectStore(type)
    const records = []
    let count = 0

    return (ids ? new Promise((resolve, reject) => {
      let counter = 0
      const verifyGet = event => {
        const record = event.target.result
        if (record) {
          records.push(record)
          count++
        }
        counter++
        if (counter === ids.length) return resolve(records)
      }

      for (let id of ids) {
        const request = objectStore.get(type + delimiter + id)
        request.onsuccess = verifyGet
        request.onerror = reject
      }
    }) : new Promise((resolve, reject) => {
      const cursor = objectStore.openCursor()
      cursor.onsuccess = event => {
        const iterator = event.target.result
        if (iterator) {
          count++
          records.push(iterator.value)
          return iterator.continue()
        }
        return resolve(records)
      }
      cursor.onerror = reject
    }))

    .then(records => {
      // Unfortunately, IndexedDB doesn't have native support for most of what
      // we want to query for, so we have to implement it ourselves.
      records = applyOptions(count, fields, records, options)
      count = records.count

      const result = records.map(outputRecord.bind(this, type))
      result.count = count

      return result
    })
  }


  update (type, updates) {
    if (!updates.length) return super.update()

    const { db, keys: { primary: primaryKey } } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)
    let found = 0
    let count = 0
    let done = 0

    return new Promise((resolve, reject) => {
      for (let update of updates) {
        const getRequest = objectStore.get(
          type + delimiter + update[primaryKey])
        getRequest.onerror = reject
        getRequest.onsuccess = doUpdate.bind(null, update)
      }

      function doUpdate (update, event) {
        found++

        const record = event.target.result

        // If we found all records and there's nothing to update,
        // resolve with 0.
        if (!record)
          return found === updates.length && !count ? resolve(0) : null

        count++

        applyUpdate(record, update)

        const putRequest = objectStore.put(record)
        putRequest.onerror = reject
        putRequest.onsuccess = () => {
          done++
          if (done === found) return resolve(count)
        }
      }
    })
  }


  delete (type, ids) {
    if (ids && !ids.length) return super.delete()

    const { db } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)

    if (ids)
      return new Promise((resolve, reject) => {
        const idSet = new Set()
        let count = 0

        // In order to ensure correct execution order, use 2 loops.

        for (let id of ids) {
          const getRequest = objectStore.get(type + delimiter + id)
          getRequest.onsuccess = verifyGet.bind(null, id)
          getRequest.onerror = reject
        }

        for (let id of ids) {
          const deleteRequest = objectStore.delete(type + delimiter + id)
          deleteRequest.onsuccess = verifyDelete.bind(null, id)
          deleteRequest.onerror = reject
        }

        function verifyDelete (id) {
          if (idSet.has(id)) count++
          if (count === idSet.size) return resolve(count)
        }

        function verifyGet (id, event) {
          if (event.target.result) idSet.add(id)
        }
      })

    return new Promise((resolve, reject) => {
      let count

      const countRequest = objectStore.count()
      countRequest.onsuccess = event => count = event.target.result
      countRequest.onerror = reject

      const clearRequest = objectStore.clear()
      clearRequest.onsuccess = () => resolve(count)
      clearRequest.onerror = reject
    })
  }

}
