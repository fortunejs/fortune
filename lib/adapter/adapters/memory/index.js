import { applyOptions } from '../common'
import applyUpdate from '../../../common/apply_update'
import { inputRecord, outputRecord } from './helpers'


/**
 * Memory adapter.
 */
export default Adapter => class MemoryAdapter extends Adapter {

  connect () {
    this.db = {}

    const { recordTypes } = this

    for (let type in recordTypes)
      this.db[type] = {}

    return Promise.resolve()
  }


  disconnect () {
    delete this.db
    return Promise.resolve()
  }


  find (type, ids, options) {
    if (ids && !ids.length) return super.find()

    const { db, recordTypes } = this
    const fields = recordTypes[type]
    const collection = db[type]
    let records = []
    let count = 0

    if (ids) for (let id of ids) {
      const record = collection[id]
      if (record) {
        count++
        records.push(outputRecord.call(this, type, record))
      }
    }
    else for (let id in collection) {
      count++
      records.push(outputRecord.call(this, type, collection[id]))
    }

    return Promise.resolve(applyOptions(count, fields, records, options))
  }


  create (type, records) {
    records = records.map(inputRecord.bind(this, type))

    const { db, keys: { primary: primaryKey },
      errors: { ConflictError } } = this
    const collection = db[type]

    for (let record of records) {
      const id = record[primaryKey]

      if (id in collection)
        return Promise.reject(new ConflictError(
          `Record with ID "${id}" already exists.`))
    }

    for (let record of records) collection[record[primaryKey]] = record

    return Promise.resolve(records.map(outputRecord.bind(this, type)))
  }


  update (type, updates) {
    if (!updates.length) return super.update()

    const { db, keys: { primary: primaryKey } } = this
    const collection = db[type]
    let count = 0

    for (let update of updates) {
      const id = update[primaryKey]
      let record = collection[id]

      if (!record) continue

      count++
      record = outputRecord.call(this, type, record)

      applyUpdate(record, update)

      collection[id] = inputRecord.call(this, type, record)
    }

    return Promise.resolve(count)
  }


  delete (type, ids) {
    if (ids && !ids.length) return super.delete()

    const { db } = this
    const collection = db[type]
    let count = 0

    if (ids) for (let id of ids) {
      if (id in collection) {
        count++
        delete collection[id]
      }
    }
    else for (let id in collection) {
      count++
      delete collection[id]
    }

    return Promise.resolve(count)
  }

}
