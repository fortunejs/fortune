import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as updateHelpers from '../update_helpers'


/**
 * Delete records. This does not mutate context.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type, ids } = context.request
  const { methods, adapter, schemas, transforms } = this
  const updates = {}
  let transaction, records

  if (!ids.length)
    throw new errors.BadRequestError(
      `No IDs were specified to be deleted.`)

  const schema = schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => keys.link in schema[field]))

  return adapter.find(type, ids)

  .then(foundRecords => {
    records = foundRecords

    if (!records.length)
      throw new errors.NotFoundError(
        `There are no records to be deleted.`)

    return 'input' in (transforms[type] || {}) ?
      records.map(record => transforms[type].input(context, record)) :
      records
  })

  .then(() => adapter.beginTransaction())

  .then(t => {
    transaction = t
    return transaction.delete(type, ids)
  })

  .then(() => {
    // Remove all instances of the deleted IDs in all records.
    const idCache = {}

    // Loop over each record to generate updates object.
    records.forEach(record => links.forEach(field => {
      const inverseField = schema[field][keys.inverse]

      if (!(field in record) || !inverseField) return

      const linkedType = schema[field][keys.link]
      const linkedIsArray = schemas[linkedType][inverseField][keys.isArray]
      const linkedIds = Array.isArray(record[field]) ?
        record[field] : [record[field]]

      // Do some initialization.
      if (!(linkedType in updates)) updates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      linkedIds.forEach(id => id !== null ?
        updateHelpers.removeId(record[keys.primary],
          updateHelpers.getUpdate(linkedType, id, updates, idCache),
          inverseField, linkedIsArray) : null)
    }))

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
    const eventData = {
      [methods.delete]: { [type]: ids }
    }

    Object.keys(updates).forEach(type => {
      if (!updates[type].length) return
      if (!(methods.update in eventData)) eventData[methods.update] = {}
      eventData[methods.update][type] =
        updates[type].map(update => update[keys.primary])
    })

    // Summarize changes during the lifecycle of the request.
    this.emit(this.change, eventData)

    return context
  })
}