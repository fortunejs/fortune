import Store from 'nedb'


const idKey = '_id'
const bufferEncoding = 'base64'


/**
 * NeDB adapter.
 */
export default Adapter => class NedbAdapter extends Adapter {

  initialize () {
    this.db = objectMap(this.schemas, (schema, type) =>
      new Store((this.options || {})[type]))

    return Promise.all(Object.keys(this.db).map(type =>
      new Promise((resolve, reject) =>
        this.db[type].loadDatabase(error => error ? reject(error) : resolve())
    )))
  }


  find (type, ids, options = {}) {
    return new Promise((resolve, reject) => {
      const query = {}

      if ('filter' in options)
        Object.assign(query, options.filter)

      if ('match' in options)
        Object.assign(query, objectMap(options.match, value =>
          Array.isArray(value) ? { $in: value } : value
      ))

      if (ids.length)
        query[idKey] = { $in: ids }

      const args = [query]

      if ('fields' in options)
        args.push(objectMap(options.fields, value => value ? 1 : 0))

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
    return Promise.all(updates.map(update =>
      new Promise((resolve, reject) => {
        const modifiers = {}

        if ('set' in update)
          modifiers.$set = update.set

        if ('unset' in update)
          modifiers.$unset = update.unset

        if ('push' in update)
          modifiers.$push = objectMap(update.push, value =>
            Array.isArray(value) ? { $each: value } : value)

        if ('pull' in update)
          modifiers.$pull = objectMap(update.pull, value =>
            Array.isArray(value) ? { $in: value } : value)

        // Custom update operators have precedence.
        Object.assign(modifiers, update.operate)

        this.db[type].update({ [idKey]: update.id }, modifiers, {},
          error => error ? reject(error) : resolve())
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
  const schema = this.schemas[type]

  // ID business.
  const id = record[this.primaryKey]
  delete record[this.primaryKey]
  if (id) record[idKey] = id

  for (let field in schema) {
    const fieldType = schema[field][this.keys.type]
    const fieldIsArray = schema[field][this.keys.isArray]

    if (!(field in record))
      record[field] = fieldIsArray ? [] : null

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && Buffer.isBuffer(record[field]))
      record[field] = record[field].toString(bufferEncoding)
  }

  return record
}


function outputRecord (type, record) {
  const schema = this.schemas[type]

  // ID business.
  const id = record[idKey]
  delete record[idKey]
  record[this.primaryKey] = id

  // Non-native types.
  for (let field in record) {
    if (field in schema) {
      const fieldType = schema[field][this.keys.type]

      // NeDB lacks native support for buffer types.
      if (fieldType === Buffer && typeof record[field] === 'string')
        record[field] = new Buffer(record[field], bufferEncoding)
    }
  }

  return record
}


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} mapFunction
 * @return {Object}
 */
function objectMap (object, mapFunction) {
  return Object.keys(object).reduce((clone, key) => {
    clone[key] = mapFunction(object[key], key)
    return clone
  }, {})
}
