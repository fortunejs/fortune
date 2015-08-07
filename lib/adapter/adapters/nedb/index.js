import Store from 'nedb'
import { inputRecord, outputRecord, mapValues,
  castValue, idKey } from './helpers'


// By default, try to auto-compact the database every minute.
const defaultCompactionInterval = 60 * 1000


/**
 * NeDB adapter.
 */
export default Adapter => class NedbAdapter extends Adapter {

  connect () {
    const { recordTypes, options } = this

    try {
      this.db = mapValues(recordTypes, (fields, type) => {
        const db = new Store(options[type])
        db.persistence.setAutocompactionInterval(
          options[type] && options[type].compactionInterval ?
          options[type].compactionInterval : defaultCompactionInterval)
        return db
      })
    }
    catch (error) {
      return Promise.reject(error)
    }

    return Promise.all(Object.keys(this.db).map(type =>
      new Promise((resolve, reject) =>
        this.db[type].loadDatabase(error => error ? reject(error) : resolve())
    )))
    .then(() => null)
  }


  disconnect () {
    return Promise.all(
      Object.keys(this.db).map(key => new Promise(resolve => {
        const db = this.db[key]

        // This auto compaction interval prevents the process from exiting.
        db.persistence.stopAutocompaction()

        // Internal hook to NeDB's executor which will run after all other
        // operations are done.
        db.executor.push({ fn: resolve, arguments: [] })
      }))
    ).then(() => null)
  }


  find (type, ids, options = {}) {
    // Handle no-op.
    if (ids && !ids.length) return super.find()

    const query = {}

    try {
      if ('match' in options)
        Object.assign(query, mapValues(options.match, value =>
          Array.isArray(value) ? { $in: value.map(castValue) } :
          castValue(value)))

      if ('query' in options)
        Object.assign(query, options.query)

      if (ids && ids.length)
        query[idKey] = { $in: ids }
    }
    catch (error) {
      return Promise.reject(error)
    }

    // Parallelize the find method with count method.
    return Promise.all([
      new Promise((resolve, reject) => {
        const args = [ query ]

        if ('fields' in options)
          args.push(mapValues(options.fields, value => value ? 1 : 0))

        const find = this.db[type].find(...args)

        if ('sort' in options)
          find.sort(mapValues(options.sort, value => value ? 1 : -1))

        if ('offset' in options)
          find.skip(options.offset)

        if ('limit' in options)
          find.limit(options.limit)

        find.exec((error, records) => error ? reject(error) :
          resolve(records.map(outputRecord.bind(this, type)))
        )
      }),
      new Promise((resolve, reject) =>
        this.db[type].count(query, (error, count) => error ?
          reject(error) : resolve(count)))
    ])

    .then(results => {
      // Set the count on the records array.
      results[0].count = results[1]
      return results[0]
    })
  }


  create (type, records) {
    const { errors: { ConflictError } } = this

    return new Promise((resolve, reject) =>
      this.db[type].insert(
        records.map(inputRecord.bind(this, type)),
        (error, result) => error ?
          reject(error.errorType === 'uniqueViolated' ?
            new ConflictError(`Duplicate key.`) : error) :
          resolve(result.map(outputRecord.bind(this, type)))
      ))
  }


  update (type, updates) {
    const { keys } = this

    return Promise.all(updates.map(update =>
      new Promise((resolve, reject) => {
        const modifiers = {}

        if ('replace' in update)
          modifiers.$set = update.replace

        if ('push' in update)
          modifiers.$push = mapValues(update.push, value =>
            Array.isArray(value) ? { $each: value } : value)

        if ('pull' in update)
          modifiers.$pull = mapValues(update.pull, value =>
            Array.isArray(value) ? { $in: value } : value)

        // Custom update operators have precedence.
        Object.assign(modifiers, update.operate)

        // Short circuit no-op.
        if (!Object.keys(modifiers).length) resolve(0)

        this.db[type].update({ [idKey]: update[keys.primary] },
          modifiers, {}, (error, number) => error ?
          reject(error) : resolve(number))
      })
    ))
    .then(numbers => numbers.reduce((accumulator, number) =>
      accumulator + number, 0))
  }


  delete (type, ids) {
    if (ids && !ids.length) return super.delete()

    return new Promise((resolve, reject) =>
      this.db[type].remove(ids && ids.length ?
        { [idKey]: { $in: ids } } : {}, { multi: true },
        (error, number) => error ? reject(error) : resolve(number)))
  }

}
