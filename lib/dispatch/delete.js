import clone from 'clone'
import change from '../common/change'
import {
  delete as deleteMethod,
  update as updateMethod
} from '../common/methods'
import {
  primary as primaryKey,
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey
} from '../common/keys'
import { NotFoundError } from '../common/errors'
import * as updateHelpers from './update_helpers'


/**
 * Delete records. This does not mutate context.
 *
 * @return {Promise}
 */
export default function (context) {
  const { request: { type, ids, meta } } = context
  const { adapter, recordTypes, transforms } = this
  const updates = {}
  const fields = recordTypes[type]
  const transform = transforms[type]
  const links = Object.keys(fields)
    .filter(field => linkKey in fields[field])

  let transaction
  let records

  return (ids ? adapter.find(type, ids, null, meta) : Promise.resolve([]))

  .then(foundRecords => {
    records = foundRecords

    if (ids) {
      if (!records.length)
        throw new NotFoundError(`There are no records to be deleted.`)

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })
    }

    return transform && transform.input ? Promise.all(records.map(record =>
      transform.input(context, clone(record)))) : records
  })

  .then(() => adapter.beginTransaction())

  .then(t => {
    transaction = t
    return transaction.delete(type, ids, meta)
  })

  .then(() => {
    // Remove all instances of the deleted IDs in all records.
    const idCache = {}

    // Loop over each record to generate updates object.
    for (let record of records)
      for (let field of links) {
        const inverseField = fields[field][inverseKey]

        if (!(field in record) || !inverseField) continue

        const linkedType = fields[field][linkKey]
        const linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]
        const linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        // Do some initialization.
        if (!(linkedType in updates)) updates[linkedType] = []
        if (!(linkedType in idCache)) idCache[linkedType] = new Set()

        for (let id of linkedIds)
          if (id !== null)
            updateHelpers.removeId(record[primaryKey],
              updateHelpers.getUpdate(linkedType, id, updates, idCache),
              inverseField, linkedIsArray)
      }

    return Promise.all(Object.keys(updates)
      .map(type => updates[type].length ?
        transaction.update(type, updates[type], meta) :
        null))
  })

  .then(() => transaction.endTransaction())

  .catch(error => {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(() => {
    const mapId = update => update[primaryKey]

    const eventData = {
      [deleteMethod]: { [type]: ids }
    }

    if (Object.keys(updates).length) {
      eventData[updateMethod] = {}

      for (let type in updates) {
        if (!updates[type].length) continue
        eventData[updateMethod][type] = updates[type].map(mapId)
      }
    }

    // Summarize changes during the lifecycle of the request.
    this.emit(change, eventData)

    return context
  })
}
