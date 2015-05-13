import checkLinks from '../check_links'
import enforce from '../../schema/enforce'
import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'
import * as updateHelpers from '../update_helpers'


/**
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type } = context.request
  const { methods, adapter, serializer, schemas, transforms } = this
  const updates = {}
  let records = serializer.parseCreate(context)
  let transaction

  if (!records || !records.length)
    throw new errors.BadRequestError(
      `There are no valid records in the request.`)

  const schema = schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  // Delete denormalized inverse fields.
  for (let field in schema) {
    if (keys.denormalizedInverse in schema[field])
      for (let record of records) {
        delete record[field]
      }
  }

  return Promise.all(records.map(record => {
    // Enforce the schema before running transform.
    record = enforce(type, record, schemas[type])

    // Ensure referential integrity.
    return checkLinks(record, schema, links, adapter)

    // Do input transforms.
    .then(() => 'input' in (transforms[type] || {}) ?
      transforms[type].input(context, record) : record)
  }))

  .then(transformedRecords => {
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
    if (arrayProxy.find(createdRecords, record => !(keys.primary in record)))
        throw new Error(`ID on created record is missing.`)

    // Update inversely linked records on created records.
    // Trying to batch updates to be as few as possible.
    const idCache = {}

    // Iterate over each record to generate updates object.
    createdRecords.forEach(record => links.forEach(field => {
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
        updateHelpers.addId(record[keys.primary],
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
    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    const eventData = {
      [methods.create]: {
        [type]: records.map(record => record[keys.primary])
      }
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
