import Store from 'nedb'


const idKey = '_id'
const bufferEncoding = 'base64'

// Auto-compact the database every minute.
const compactionInterval = 60 * 1000


/**
 * NeDB adapter.
 */
export default Adapter => class NedbAdapter extends Adapter {

  connect () {
    const { schemas } = this
    const options = this.options || {}

    try {
      this.db = mapValues(schemas, (schema, type) => {
        const db = new Store((options)[type])
        db.persistence.setAutocompactionInterval(
          options.compactionInterval || compactionInterval)
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
    const query = {}

    // Handle no-op.
    if (ids && !ids.length)
      return super.find()

    try {
      if ('match' in options)
        Object.assign(query, mapValues(options.match, value =>
          Array.isArray(value) ? { $in: value } : value))

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
        const args = [query]

        if ('fields' in options)
          args.push(mapValues(options.fields, value => value ? 1 : 0))

        const find = this.db[type].find(...args)

        if ('sort' in options)
          find.sort(options.sort)

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
    const { errors } = this

    return new Promise((resolve, reject) =>
      this.db[type].insert(
        records.map(inputRecord.bind(this, type)),
        (error, result) => error ?
          reject(error.errorType === 'uniqueViolated' ?
            new errors.ConflictError(`Duplicate key error.`) : error) :
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

        this.db[type].update({ [idKey]: update[keys.primary] },
          modifiers, {}, (error, number) => error ?
          reject(error) : resolve(number))
      })
    ))
    .then(numbers => numbers.reduce((accumulator, number) =>
      accumulator + number, 0))
  }


  delete (type, ids) {
    return new Promise((resolve, reject) =>
      this.db[type].remove(ids && ids.length ?
        { [idKey]: { $in: ids } } : {}, { multi: true },
        (error, number) => error ? reject(error) : resolve(number)))
  }

}


// Assign default values per schema field.
function inputRecord (type, record) {
  const clone = {}
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  const id = record[keys.primary]
  if (id) clone[idKey] = id

  for (let field in record) {
    clone[field] = record[field]
  }

  Object.keys(schema).forEach(field => {
    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      return
    }

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(buffer => buffer.toString(bufferEncoding)) :
        record[field].toString(bufferEncoding)
      return
    }
  })

  return clone
}


// We get a new object for each record from NeDB, so we don't have to worry
// about cloning.
function outputRecord (type, record) {
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  const id = record[idKey]
  delete record[idKey]
  record[keys.primary] = id

  // Non-native types.
  Object.keys(record).forEach(field => {
    if (!(field in schema)) return

    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field])
      record[field] = fieldIsArray ?
        record[field].map(string => new Buffer(string, bufferEncoding)) :
        new Buffer(record[field], bufferEncoding)
  })

  return record
}


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} map should return the first argument, which is the value
 * @return {Object}
 */
function mapValues (object, map) {
  return Object.keys(object).reduce((clone, key) => {
    clone[key] = map(object[key], key)
    return clone
  }, {})
}
