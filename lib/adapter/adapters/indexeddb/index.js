import { getGlobalObject, inputRecord, outputRecord,
  matchByField, sortByField, idDelimiter } from './helpers'


const { indexedDB } = getGlobalObject()


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

        for (let type in recordTypes)
          if (!db.objectStoreNames.contains(type))
            db.createObjectStore(type, { keyPath: keys.primary })
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

    const { db, errors } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)

    return Promise.all(records.map(record => new Promise((resolve, reject) => {
      const request = objectStore.add(record)
      request.onsuccess = resolve
      request.onerror = event => {
        if (event.target.error.name === 'ConstraintError')
          return reject(new errors.ConflictError(
            `Unique key constraint violated.`))

        return reject(event.target.error)
      }
    })))

    .then(() => records.map(outputRecord.bind(this, type)))
  }


  find (type, ids, options = {}) {
    // Handle no-op.
    if (ids && !ids.length) return super.find()

    const { db, recordTypes, keys, errors } = this
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
        const request = objectStore.get(type + idDelimiter + id)
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

      if ('match' in options) {
        records = records.filter(matchByField.bind(this,
          recordTypes[type], options.match))
        count = records.length
      }

      if ('fields' in options) {
        const isInclude = Object.keys(options.fields)
          .every(field => options.fields[field])
        const isExclude = Object.keys(options.fields)
          .every(field => !options.fields[field])

        if (!(isInclude || isExclude))
          throw new errors.BadRequestError(`Fields format is invalid.`)

        for (let record of records) for (let field in record) {
          if (field === keys.primary) continue
          if ((isInclude && !(field in options.fields)) ||
            (isExclude && field in options.fields))
            delete record[field]
        }
      }

      for (let field in options.sort)
        records = records.sort(sortByField.bind(this,
          recordTypes[type][field], field, options.sort[field]))

      if ('limit' in options || 'offset' in options)
        records = records.slice(options.offset,
          options.offset && options.limit ?
          options.offset + options.limit : options.limit)

      const result = records.map(outputRecord.bind(this, type))
      result.count = count
      return result
    })
  }


  update (type, updates) {
    if (!updates.length) return super.update()

    const { db, keys } = this
    const transaction = db.transaction(type, 'readwrite')
    const objectStore = transaction.objectStore(type)
    let found = 0
    let count = 0
    let done = 0

    return new Promise((resolve, reject) => {
      for (let update of updates) {
        const getRequest = objectStore.get(
          type + idDelimiter + update[keys.primary])
        getRequest.onerror = reject
        getRequest.onsuccess = doUpdate.bind(null, update)
      }

      function doUpdate (update, event) {
        found++

        const record = event.target.result

        if (!record) {
          // If we found all records and there's nothing to update,
          // resolve with 0.
          if (found === updates.length && !count) return resolve(0)
          return null
        }

        count++

        for (let field in update.replace)
          record[field] = update.replace[field]

        for (let field in update.push) {
          let values = update.push[field]
          if (!Array.isArray(values)) values = [ values ]
          record[field].push(...values)
        }

        function pull (x) { return !this.has(x) }

        for (let field in update.pull) {
          let values = update.pull[field]
          if (!Array.isArray(values)) values = [ values ]
          const set = new Set(values)
          record[field] = record[field].filter(pull.bind(set))
        }

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
          const getRequest = objectStore.get(type + idDelimiter + id)
          getRequest.onsuccess = verifyGet.bind(null, id)
          getRequest.onerror = reject
        }

        for (let id of ids) {
          const deleteRequest = objectStore.delete(type + idDelimiter + id)
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
      countRequest.onsuccess = () => count = countRequest.result
      countRequest.onerror = reject

      const clearRequest = objectStore.clear()
      clearRequest.onsuccess = () => resolve(count)
      clearRequest.onerror = reject
    })
  }

}
