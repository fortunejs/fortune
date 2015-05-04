import checkLinks from '../check_links'
import applyUpdate from '../apply_update'
import enforce from '../../schema/enforce'
import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'
import * as operations from '../update_operations'


/**
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type } = context.request
  const { adapter, serializer, events, schemas, transforms } = this
  const updates = serializer.parseUpdate(context)

  // Keyed by update, valued by record.
  const updateMap = new WeakMap()

  // Keyed by update, valued by object with fields valued by linked records.
  const linkedMap = new WeakMap()

  const schema = schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  const relatedUpdates = {}
  let transaction

  validateUpdates(updates)

  return adapter.find(type, updates.map(update => update[keys.primary]))

  .then(records => Promise.all(records.map(record => {
    const update = arrayProxy.find(updates, update =>
      update[keys.primary] === record[keys.primary])

    if (!update)
      throw new errors.NotFoundError(
        `The record to be updated could not be found.`)

    updateMap.set(update, record)

    // Apply updates to record.
    record = applyUpdate(record, schema, update)

    // Enforce the schema before running transform.
    record = enforce(type, record, schema)

    // Ensure referential integrity.
    return checkLinks(record, schema, links, adapter)

    // Do input transforms.
    .then(linked => {
      linkedMap.set(update, linked)

      if (transforms[type] && 'input' in transforms[type])
        return transforms[type].input(context, record)
    })
  })))

  .then(() => adapter.beginTransaction())

  .then(t => {
    transaction = t
    return transaction.update(type, updates)
  })

  .then(() => {
    // Build up related updates based on update objects.
    const idCache = {}

    // Iterate over each update to generate related updates.
    updates.forEach(update => links.forEach(field => {
      const inverseField = schema[field][keys.inverse]

      if (!inverseField) return

      const linkedType = schema[field][keys.link]
      const linkedIsArray = schemas[linkedType][inverseField][keys.isArray]

      // Do some initialization.
      if (!(linkedType in relatedUpdates)) relatedUpdates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      // Setting a link field is pretty complicated.
      if (update.set && field in update.set) {
        const id = update.set[field]
        const record = updateMap.get(update)
        const linked = linkedMap.get(update)

        // Set related field.
        if (id !== null)
          operations.addId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray)

        // Unset 2nd degree related record.
        if (linked[field] &&
          linked[field][inverseField] !== null &&
          !Array.isArray(linked[field][inverseField]) &&
          linked[field][inverseField] !== update.id)
          operations.removeId(id,
            operations.getUpdate(
              linkedType, linked[field][inverseField],
              relatedUpdates, idCache),
            inverseField, linkedIsArray)

        // For unsetting, remove ID from related record.
        if (record[field] !== null &&
          record[field] !== update[field] &&
          record[field] !== id)
          operations.removeId(update.id,
            operations.getUpdate(
              linkedType, record[field], relatedUpdates, idCache),
            inverseField, linkedIsArray)

        // After this point, there's no need to go over array operations.
        return
      }

      if (update.push && field in update.push) {
        const push = Array.isArray(update.push[field]) ?
          update.push[field] : [update.push[field]]

        push.forEach(id => id !== null ?
          operations.addId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)
      }

      if (update.pull && field in update.pull) {
        const pull = Array.isArray(update.pull[field]) ?
          update.pull[field] : [update.pull[field]]

        pull.forEach(id => id !== null ?
          operations.removeId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)
      }
    }))

    return Promise.all(Object.keys(relatedUpdates)
      .map(type => relatedUpdates[type].length ?
        transaction.update(type, relatedUpdates[type]) :
        Promise.resolve()))
  })

  .then(() => transaction.endTransaction())

  .catch(error => {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(() => {
    const eventData = {
      [events.update]: {
        [type]: updates.map(update => update[keys.primary])
      }
    }

    Object.keys(relatedUpdates).forEach(linkedType => {
      if (!relatedUpdates[linkedType].length) return
      if (!(events.update in eventData)) eventData[events.update] = {}
      if (linkedType !== type)
        eventData[events.update][linkedType] =
          relatedUpdates[linkedType].map(update => update[keys.primary])
      else
        // Get the union of update IDs.
        eventData[events.update][type] = [...union(
          eventData[events.update][type],
          relatedUpdates[type].map(update => update[keys.primary]))]
    })

    // Summarize changes during the lifecycle of the request.
    this.emit(events.change, eventData)

    return context
  })
}


// Get the union of arrays with unique values by means of the Set type.
function union () {
  return new Set(Array.prototype.reduce.call(arguments,
    (memo, array) => {
      memo.push(...array)
      return memo
    }, []))
}


// Validate updates.
function validateUpdates (updates) {
  if (!updates || !updates.length)
    throw new errors.BadRequestError(
      `There are no valid updates in the request.`)

  updates.forEach(update => {
    if (!(keys.primary in update))
      throw new errors.BadRequestError(
        `The required field "${keys.primary}" on the update is missing.`)
  })
}
