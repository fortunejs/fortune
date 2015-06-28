/* global window */
import { inputRecord, outputRecord } from './helpers'


const { indexedDB } = window


/**
 * IndexedDB adapter, optimized for browser. Available options:
 *
 * - `name`: Name of the database to connect to.
 */
export default Adapter => class IndexedDBAdapter extends Adapter {

  connect () {
    const { recordTypes, options, keys } = this
    const name = options.name || 'fortune'
    const request = indexedDB.open(name)

    return new Promise((resolve, reject) => {
      request.onerror = reject
      request.onupgradeneeded = event => {
        const db = event.target.result

        for (let type in recordTypes) {
          const fields = recordTypes[type]
          const objectStore = db.createObjectStore(type, {
            keyPath: keys.primary
          })

          for (let field in fields)
            objectStore.createIndex(field, field)
        }
      }
      request.onsuccess = () => {
        this.db = request.result
        return resolve()
      }
    })
  }


  disconnect () {
    this.db.close()
    return Promise.resolve()
  }


  create (type, records) {
    records = records.map(inputRecord.bind(this, type))

    const { db } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)

    return Promise.all(records.map(record => new Promise((resolve, reject) => {
      const request = objectStore.add(record)
      request.onsuccess = resolve
      request.onerror = reject
    })))

    .then(() => records.map(outputRecord.bind(this, type)))
  }


  find (type, ids, options = {}) {
    const { db } = this
    const transaction = db.transaction(type, 'readonly')
    const objectStore = transaction.objectStore(type)
    let count

    return (ids ? Promise.all(ids.map(id => new Promise((resolve, reject) => {
      const request = objectStore.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = reject
    }))) : new Promise((resolve, reject) => {

    }))

    .then(records => {
      const result = records.map(outputRecord.bind(this, type))
      result.count = count
      return result
    })
  }


  delete (type, ids) {
    const { db } = this
    let count

    return (ids ? Promise.all(ids.map(id => new Promise((resolve, reject) => {
      const transaction = db.transaction(type, 'readwrite')
      const objectStore = transaction.objectStore(type)
      const request = objectStore.delete(id)
      request.onsuccess = resolve
      request.onerror = reject
    }))) : new Promise((resolve, reject) => {
      const transaction = db.transaction(type, 'readwrite')
      const objectStore = transaction.objectStore(type)
      const request = objectStore.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = reject
    })
    .then(result => {
      count = result

      return ids ? this.find(type, ids)
      .then(records => { count = records.length }) :
      new Promise((resolve, reject) => {
        const transaction = db.transaction(type, 'readwrite')
        const objectStore = transaction.objectStore(type)
        const request = objectStore.clear()
        request.onsuccess = resolve
        request.onerror = reject
      })
    }))

    .then(() => count)
  }

}
