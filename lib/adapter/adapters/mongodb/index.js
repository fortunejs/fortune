import { MongoClient } from 'mongodb'


const idKey = '_id'


/**
 * MongoDB adapter.
 */
export default Adapter => class MongodbAdapter extends Adapter {

  initialize () {
    const { options } = this

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


  close () {
    return Promise.resolve(this.db.close())
  }


  find (type, ids, options = {}) {
    return new Promise((resolve, reject) => {
      const query = {}

      if ('filter' in options)
        Object.assign(query, options.filter)

      if ('match' in options)
        Object.assign(query, mapValues(options.match, value =>
          Array.isArray(value) ? { $in: value } : value
      ))

      if (ids.length)
        query[idKey] = { $in: ids }

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
    })
  }


  create (type, records) {
    return new Promise((resolve, reject) =>
      this.db.collection(type).insert(
        records.map(inputRecord.bind(this, type)),
        (error, result) => error ? reject(error) :
        resolve(result.ops.map(outputRecord.bind(this, type)))
      ))
  }


  update (type, updates) {
    const { keys } = this

    return Promise.all(updates.map(update =>
      new Promise((resolve, reject) => {
        const modifiers = {}

        if ('set' in update)
          modifiers.$set = update.set

        if ('push' in update)
          modifiers.$push = mapValues(update.push, value =>
            Array.isArray(value) ? { $each: value } : value)

        if ('pull' in update)
          modifiers.$pull = mapValues(update.pull, value =>
            Array.isArray(value) ? { $in: value } : value)

        // Custom update operators have precedence.
        Object.assign(modifiers, update.operate)

        this.db.collection(type).update({ [idKey]: update[keys.primary] },
          modifiers, {}, error => error ? reject(error) : resolve())
      })
    ))
  }


  delete (type, ids) {
    return new Promise((resolve, reject) => this.db.collection(type).remove(
      { [idKey]: { $in: ids } }, { multi: true },
      error => error ? reject(error) : resolve()
    ))
  }

}


// Assign default values per schema field.
function inputRecord (type, record) {
  const { schemas, keys } = this
  const schema = schemas[type]

  // ID business.
  const id = record[keys.primary]
  delete record[keys.primary]
  if (id) record[idKey] = id

  Object.keys(schema).forEach(field => {
    const fieldIsArray = schema[field][keys.isArray]

    if (!(field in record))
      record[field] = fieldIsArray ? [] : null
  })

  return record
}


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

    // Expose native Buffer.
    if (fieldType === Buffer && record[field])
      record[field] = fieldIsArray ?
        record[field].map(object => object.buffer) :
        record[field].buffer
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
