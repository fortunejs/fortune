import checkLinks from '../check_links'
import enforce from '../../record_type/enforce'
import * as keys from '../../common/keys'
import * as errors from '../../common/errors'
import * as updateHelpers from '../update_helpers'


/**
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
export default function (context) {
  const { methods, adapter, serializer, recordTypes, transforms } = this
  let records = serializer.parseCreate(context)

  if (!records || !records.length)
    throw new errors.BadRequestError(
      `There are no valid records in the request.`)

  const { type } = context.request
  const transform = transforms[type]
  const fields = recordTypes[type]
  const links = Object.keys(fields)
    .filter(field => fields[field][keys.link])

  const updates = {}
  let transaction

  // Delete denormalized inverse fields.
  for (let field in fields)
    if (fields[field][keys.denormalizedInverse])
      for (let record of records)
        delete record[field]

  return Promise.all(records.map(record => {
    // Enforce the fields before running transform.
    record = enforce(type, record, fields)

    // Ensure referential integrity.
    return checkLinks(record, fields, links, adapter)

    // Do input transforms.
    .then(() => transform && transform.input ?
      transform.input(context, record) : record)
  }))

  .then(transformedRecords => {
    // Enforce the fields after transform, and also drop arbitrary fields that
    // may have been added in the transform.
    transformedRecords = transformedRecords.map(record =>
      enforce(type, record, fields, true))

    return adapter.beginTransaction().then(t => {
      transaction = t
      return transaction.create(type, transformedRecords)
    })
  })

  .then(createdRecords => {
    records = createdRecords

    // Adapter must return something.
    if (!createdRecords.length)
      throw new errors.BadRequestError(`Records could not be created.`)

    // Each created record must have an ID.
    if (createdRecords.some(record => !(keys.primary in record)))
        throw new Error(`An ID on a created record is missing.`)

    // Update inversely linked records on created records.
    // Trying to batch updates to be as few as possible.
    const idCache = {}

    // Iterate over each record to generate updates object.
    for (let record of createdRecords) for (let field of links) {
      const inverseField = fields[field][keys.inverse]

      if (!(field in record) || !inverseField) continue

      const linkedType = fields[field][keys.link]
      const linkedIsArray = recordTypes[linkedType][inverseField][keys.isArray]
      const linkedIds = Array.isArray(record[field]) ?
        record[field] : [ record[field] ]

      // Do some initialization.
      if (!(linkedType in updates)) updates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      for (let id of linkedIds) if (id !== null)
        updateHelpers.addId(record[keys.primary],
          updateHelpers.getUpdate(linkedType, id, updates, idCache),
          inverseField, linkedIsArray)
    }

    return Promise.all(Object.keys(updates)
      .map(type => updates[type].length ?
        transaction.update(type, updates[type]) :
        Promise.resolve([])))
  })

  .then(() => transaction.endTransaction())

  .catch(error => {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(() => {
    const mapId = update => update[keys.primary]

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    const eventData = {
      [methods.create]: {
        [type]: records.map(record => record[keys.primary])
      }
    }

    for (let type of Object.keys(updates)) {
      if (!updates[type].length) continue
      if (!(methods.update in eventData)) eventData[methods.update] = {}
      eventData[methods.update][type] = updates[type].map(mapId)
    }

    // Summarize changes during the lifecycle of the request.
    this.emit(this.change, eventData)

    return context
  })
}
