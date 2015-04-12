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

      if (options.hasOwnProperty('filter'))
        Object.assign(query, options.filter)

      if (options.hasOwnProperty('match'))
        Object.assign(query, objectMap(options.match, value =>
          Array.isArray(value) ? { $in: value } : value
      ))

      if (ids.length)
        query[idKey] = { $in: ids }

      const args = [query]

      if (options.hasOwnProperty('fields'))
        args.push(objectMap(options.fields, value => value ? 1 : 0))

      const find = this.db[type].find(...args)

      if (options.hasOwnProperty('sort'))
        find.sort(options.sort)

      if (options.hasOwnProperty('offset'))
        find.skip(options.offset)

      if (options.hasOwnProperty('limit'))
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

        if (update.hasOwnProperty('set'))
          modifiers.$set = update.set

        if (update.hasOwnProperty('unset'))
          modifiers.$unset = update.unset

        if (update.hasOwnProperty('push'))
          modifiers.$push = objectMap(update.push, value =>
            Array.isArray(value) ? { $each: value } : value)

        if (update.hasOwnProperty('pull'))
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


function inputRecord (type, record) {

  // ID business.
  const id = record[this.primaryKey]
  delete record[this.primaryKey]
  if (id) record[idKey] = id

  // Non-native types.
  for (let key in record) {
    if (this.schemas[type].hasOwnProperty(key)) {
      const valueType = this.schemas[type][key][this.keys.type]

      // NeDB lacks native support for buffer types.
      if (valueType === Buffer)
        record[key] = record[key].toString(bufferEncoding)
    }
  }

  return record
}


function outputRecord (type, record) {

  // ID business.
  const id = record[idKey]
  delete record[idKey]
  record[this.primaryKey] = id

  // Non-native types.
  for (let key in record) {
    if (this.schemas[type].hasOwnProperty(key)) {
      const valueType = this.schemas[type][key][this.keys.type]

      // NeDB lacks native support for buffer types.
      if (valueType === Buffer)
        record[key] = new Buffer(record[key], bufferEncoding)
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
