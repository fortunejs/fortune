import { MongoClient } from 'mongodb'


const idKey = '_id'


/**
 * MongoDB adapter.
 */
export default Adapter => class MongodbAdapter extends Adapter {

  connect () {
    const options = this.options || {}

    return new Promise((resolve, reject) => {
      if (!('url' in options))
        return reject(new Error(`Connection URL is required in options.`))

      MongoClient.connect(options.url, (error, db) => {
        if (error) return reject(error)
        this.db = db
        return resolve()
      })
    })
  }


  disconnect () {
    try {
      this.db.close()
      return Promise.resolve()
    }
    catch (error) {
      return Promise.reject(error)
    }
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

        const find = this.db.collection(type).find(...args)

        if ('sort' in options)
          find.sort(options.sort)

        if ('offset' in options)
          find.skip(options.offset)

        if ('limit' in options)
          find.limit(options.limit)

        find.toArray((error, records) => error ? reject(error) :
          resolve(records.map(outputRecord.bind(this, type)))
        )
      }),
      new Promise((resolve, reject) =>
        this.db.collection(type).count(query, (error, count) => error ?
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
      this.db.collection(type).insert(
        records.map(inputRecord.bind(this, type)),
        (error, result) => error ?
          reject(error.code === 11000 ?
            new errors.ConflictError(`Duplicate key error.`) : error) :
          resolve(result.ops.map(outputRecord.bind(this, type)))
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

        this.db.collection(type).update({ [idKey]: update[keys.primary] },
          modifiers, {}, (error, result) =>
          error ? reject(error) : resolve(result.result.n))
      })
    ))
    .then(numbers => numbers.reduce((accumulator, number) =>
      accumulator + number, 0))
  }


  delete (type, ids) {
    return new Promise((resolve, reject) =>
      this.db.collection(type).remove(ids && ids.length ?
        { [idKey]: { $in: ids } } : {}, { multi: true },
        (error, result) => error ? reject(error) : resolve(result.result.n)))
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
    const fieldIsArray = schema[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      return
    }
  })

  return clone
}


function outputRecord (type, record) {
  const clone = {}
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  clone[keys.primary] = record[idKey]

  // Non-native types.
  Object.keys(record).forEach(field => {
    if (!(field in schema)) return

    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    // Expose native Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(object => object.buffer) :
        record[field].buffer
      return
    }

    clone[field] = record[field]
  })

  return clone
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
