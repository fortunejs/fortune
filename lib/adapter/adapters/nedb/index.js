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

    this.db = mapValues(schemas, (schema, type) => {
      const db = new Store((options)[type])
      db.persistence.setAutocompactionInterval(
        options.compactionInterval || compactionInterval)
      return db
    })

    return Promise.all(Object.keys(this.db).map(type =>
      new Promise((resolve, reject) =>
        this.db[type].loadDatabase(error => error ? reject(error) : resolve())
    )))
  }


  disconnect () {
    for (let key in this.db) {
      this.db[key].persistence.stopAutocompaction()
    }

    return Promise.resolve()
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
    })
  }


  create (type, records) {
    return new Promise((resolve, reject) =>
      this.db[type].insert(records.map(inputRecord.bind(this, type)),
        (error, createdRecords) => error ? reject(error) :
        resolve(createdRecords.map(outputRecord.bind(this, type)))
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

        this.db[type].update({ [idKey]: update[keys.primary] },
          modifiers, {}, error => error ? reject(error) : resolve())
      })
    ))
  }


  delete (type, ids) {
    return new Promise((resolve, reject) =>
      this.db[type].remove({ [idKey]: { $in: ids } }, { multi: true },
        error => error ? reject(error) : resolve())
      )
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
    const fieldType = schema[field][keys.type]
    const fieldIsArray = schema[field][keys.isArray]

    if (!(field in record))
      record[field] = fieldIsArray ? [] : null

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field])
      record[field] = fieldIsArray ?
        record[field].map(buffer => buffer.toString(bufferEncoding)) :
        record[field].toString(bufferEncoding)
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
