import { applyOptions } from '../common'
import applyUpdate from '../../../common/apply_update'
import getGlobalObject from '../../../common/global_object'
import { inputRecord, outputRecord, delimiter } from './helpers'


/**
 * Web Storage adapter. Available options:
 *
 * - `prefix`: Prefix for key names. Default: `fortune`.
 * - `storage`: name of storage global. Default: `localStorage`.
 */
export default Adapter => class WebStorageAdapter extends Adapter {

  constructor () {
    super(...arguments)

    const { options: { storage, prefix } } = this

    if (!prefix) this.options.prefix = 'fortune'
    if (!storage) this.options.storage = 'localStorage'

    this.store = getGlobalObject()[this.options.storage]
  }


  create (type, records) {
    records = records.map(inputRecord.bind(this, type))

    const { store, keys: { primary: primaryKey },
      errors: { ConflictError }, options: { prefix } } = this

    for (let record of records) {
      const key = prefix + delimiter + type +
        delimiter + record[primaryKey]

      if (store.getItem(key) !== null)
        return Promise.reject(new ConflictError(
          `Record with ID "${record[primaryKey]}" already exists.`))
    }

    for (let record of records) {
      const key = prefix + delimiter + type +
        delimiter + record[primaryKey]

      store.setItem(key, JSON.stringify(record))
    }

    return Promise.resolve(records.map(outputRecord.bind(this, type)))
  }


  find (type, ids, options) {
    if (ids && !ids.length) return super.find()

    const { store, recordTypes, options: { prefix } } = this
    const fields = recordTypes[type]
    let records = []
    let count = 0

    if (ids) for (let id of ids) {
      const key = prefix + delimiter + type + delimiter + id
      const record = store.getItem(key)
      if (record) {
        count++
        records.push(outputRecord.call(this, type, JSON.parse(record)))
      }
    }
    else for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      const parts = key.split(delimiter)

      if (parts[0] !== prefix) continue
      if (parts[1] !== type) continue

      const record = store.getItem(key)
      if (record === null) continue

      count++
      records.push(outputRecord.call(this, type, JSON.parse(record)))
    }

    return Promise.resolve(applyOptions(count, fields, records, options))
  }


  update (type, updates) {
    if (!updates.length) return super.update()

    const { store, keys: { primary: primaryKey }, options: { prefix } } = this
    let count = 0

    for (let update of updates) {
      const key = prefix + delimiter + type + delimiter + update[primaryKey]
      let record = store.getItem(key)

      if (record === null) continue

      count++
      record = outputRecord.call(this, type, JSON.parse(record))

      applyUpdate(record, update)

      store.setItem(key, JSON.stringify(inputRecord.call(this, type, record)))
    }

    return Promise.resolve(count)
  }


  delete (type, ids) {
    if (ids && !ids.length) return super.delete()

    const { store, options: { prefix } } = this
    let count = 0

    if (ids) for (let id of ids) {
      const key = prefix + delimiter + type + delimiter + id

      if (store.getItem(key) !== null) {
        count++
        store.removeItem(key)
      }
    }
    else for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      const parts = key.split(delimiter)

      if (parts[0] !== prefix) continue
      if (parts[1] !== type) continue
      if (store.getItem(key) === null) continue

      count++
      store.removeItem(key)
    }

    return Promise.resolve(count)
  }

}
