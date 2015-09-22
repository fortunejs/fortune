import validateRecords from './validate_records'
import checkLinks from './check_links'
import enforce from '../record_type/enforce'
import change from '../common/change'
import {
  create as createMethod,
  update as updateMethod
} from '../common/methods'
import {
  primary as primaryKey,
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey,
  denormalizedInverse as denormalizedInverseKey
} from '../common/keys'
import { BadRequestError } from '../common/errors'
import * as updateHelpers from './update_helpers'


/**
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
export default function (context) {
  const { adapter, serializer, recordTypes, transforms } = this
  const updates = {}

  let transaction
  let records
  let type
  let meta
  let transform
  let fields
  let links

  return serializer.parseCreate(context)

  .then(results => {
    records = results

    if (!records || !records.length)
      throw new BadRequestError(
        `There are no valid records in the request.`)

    ; ({ request: { type, meta } } = context)
    transform = transforms[type]
    fields = recordTypes[type]
    links = Object.keys(fields).filter(field => fields[field][linkKey])

    // Delete denormalized inverse fields.
    for (let field in fields)
      if (fields[field][denormalizedInverseKey])
        for (let record of records)
          delete record[field]

    return (transform && transform.input ? Promise.all(records.map(record =>
      transform.input(context, record))) : Promise.resolve(records))
  })

  .then(records => Promise.all(records.map(record => {
    // Enforce the fields.
    enforce(type, record, fields)

    // Ensure referential integrity.
    return checkLinks.call(this, record, fields, links, meta)
    .then(() => record)
  }))
  .then(records => validateRecords.call(this, records, fields, links))
  .then(() => adapter.beginTransaction())
  .then(t => {
    transaction = t
    return transaction.create(type, records, meta)
  }))

  .then(createdRecords => {
    records = createdRecords

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    // Adapter must return something.
    if (!records.length)
      throw new BadRequestError(`Records could not be created.`)

    // Each created record must have an ID.
    if (records.some(record => !(primaryKey in record)))
      throw new Error(`An ID on a created record is missing.`)

    // Update inversely linked records on created records.
    // Trying to batch updates to be as few as possible.
    const idCache = {}

    // Iterate over each record to generate updates object.
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
            updateHelpers.addId(record[primaryKey],
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
    const eventData = {
      [createMethod]: {
        [type]: records.map(record => record[primaryKey])
      }
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


function mapId (update) {
  return update[primaryKey]
}
