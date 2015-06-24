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
    const openRequest = indexedDB.open(name)

    return new Promise((resolve, reject) => {
      openRequest.onerror = reject
      openRequest.onupgradeneeded = event => {
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
      openRequest.onsuccess = () => {
        this.db = openRequest.result
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

    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = reject
    })

    .then(records.map(record => new Promise((resolve, reject) => {
      const storeRequest = objectStore.add(record)
      storeRequest.onsuccess = resolve
      storeRequest.onerror = reject
    })))

    .then(() => records.map(outputRecord.bind(this, type)))
  }

}
