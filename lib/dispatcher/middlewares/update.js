import checkLinks from '../check_links'
import enforce from '../../record_type/enforce'
import * as keys from '../../common/keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'
import * as updateHelpers from '../update_helpers'


/**
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { methods, adapter, serializer, recordTypes, transforms } = this
  const updates = serializer.parseUpdate(context)

  // Keyed by update, valued by record.
  const updateMap = new WeakMap()

  // Keyed by update, valued by hash of linked records.
  const linkedMap = new WeakMap()

  const { type } = context.request
  const fields = recordTypes[type]
  const transform = transforms[type]
  const links = Object.keys(fields)
    .filter(field => fields[field][keys.link])

  const relatedUpdates = {}
  let transaction

  validateUpdates(updates)

  // Delete denormalized inverse fields.
  for (let field in fields)
    if (fields[field][keys.denormalizedInverse])
      for (let update of updates) {
        if ('replace' in update) delete update.replace[field]
        if ('push' in update) delete update.push[field]
        if ('pull' in update) delete update.pull[field]
      }

  return adapter.find(type, updates.map(update => update.id))

  .then(records => Promise.all(records.map(record => {
    const update = arrayProxy.find(updates, update =>
      update.id === record[keys.primary])

    if (!update)
      throw new errors.NotFoundError(
        `The record to be updated could not be found.`)

    updateMap.set(update, record)

    // Apply updates to record.
    record = applyUpdate(record, fields, update)

    // Apply operators to record.
    if ('operate' in update)
      record = adapter.applyOperators(record, update.operate)

    // Enforce the fields before running transform.
    record = enforce(type, record, fields)

    // Ensure referential integrity.
    return checkLinks(record, fields, links, adapter)

    // Do input transforms.
    .then(linked => {
      linkedMap.set(update, linked)
      return transform && transform.input ?
        transform.input(context, record) : record
    })
  })))

  .then(transformedRecords => {
    // Enforce the fields after transform.
    transformedRecords = transformedRecords.map(record =>
      enforce(type, record, fields))

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: transformedRecords
    })

    return adapter.beginTransaction()
  })

  .then(t => {
    transaction = t

    // Drop fields in the updates that aren't defined in the record type.
    for (let update of updates) dropFields(update, fields)

    return transaction.update(type, updates)
  })

  .then(() => {
    // Build up related updates based on update objects.
    const idCache = {}

    // Iterate over each update to generate related updates.
    for (let update of updates) for (let field of links) {
      const inverseField = fields[field][keys.inverse]

      if (!inverseField) continue

      const isArray = fields[field][keys.isArray]
      const linkedType = fields[field][keys.link]
      const linkedIsArray = recordTypes[linkedType][inverseField][keys.isArray]

      // Do some initialization.
      if (!(linkedType in relatedUpdates)) relatedUpdates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      const record = updateMap.get(update)
      const linked = linkedMap.get(update)

      // Replacing a link field is pretty complicated.
      if (update.replace && field in update.replace) {
        const id = update.replace[field]

        if (!Array.isArray(id)) {
          // Set related field.
          if (id !== null)
            updateHelpers.addId(update.id,
              updateHelpers.getUpdate(linkedType, id, relatedUpdates, idCache),
              inverseField, linkedIsArray)

          // Unset 2nd degree related record.
          if (linked[field] &&
            linked[field][inverseField] !== null &&
            !linkedIsArray &&
            linked[field][inverseField] !== update.id)
            updateHelpers.removeId(id,
              updateHelpers.getUpdate(
                linkedType, linked[field][inverseField],
                relatedUpdates, idCache),
              inverseField, linkedIsArray)

          // For unsetting, remove ID from related record.
          if (record[field] !== null &&
            record[field] !== update[field] &&
            record[field] !== id)
            updateHelpers.removeId(update.id,
              updateHelpers.getUpdate(
                linkedType, record[field], relatedUpdates, idCache),
              inverseField, linkedIsArray)

          // After this point, there's no need to go over push/pull.
          continue
        }

        const ids = id

        // Initialize array.
        if (!update.push) update.push = {}
        if (!update.pull) update.pull = {}
        update.push[field] = []
        update.pull[field] = []

        // Compute differences, and mutate the update.
        for (let id of ids) if (!arrayProxy.includes(record[field], id))
          update.push[field].push(id)

        for (let id of record[field]) if (!arrayProxy.includes(ids, id))
          update.pull[field].push(id)
      }

      if (update.push && field in update.push) {
        const push = Array.isArray(update.push[field]) ?
          update.push[field] : [ update.push[field] ]

        for (let id of push) if (id !== null)
          updateHelpers.addId(update.id,
            updateHelpers.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray)
      }

      if (update.pull && field in update.pull) {
        const pull = Array.isArray(update.pull[field]) ?
          update.pull[field] : [ update.pull[field] ]

        for (let id of pull) if (id !== null)
          updateHelpers.removeId(update.id,
            updateHelpers.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray)
      }

      // Unset from 2nd degree related records.
      if (linked[field] && !linkedIsArray) {
        const partialRecords = Array.isArray(linked[field]) ?
          linked[field] : [ linked[field] ]

        for (let partialRecord of partialRecords) {
          if (partialRecord[inverseField] === update.id) continue

          updateHelpers.removeId(partialRecord.id,
            updateHelpers.getUpdate(
              type, partialRecord[inverseField],
              relatedUpdates, idCache),
            field, isArray)
        }
      }
    }

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
    const mapId = update => update.id

    const eventData = {
      [methods.update]: {
        [type]: updates.map(update => update.id)
      }
    }

    for (let linkedType of Object.keys(relatedUpdates)) {
      if (!relatedUpdates[linkedType].length) continue
      if (!(methods.update in eventData)) eventData[methods.update] = {}
      if (linkedType !== type)
        eventData[methods.update][linkedType] =
          relatedUpdates[linkedType].map(mapId)
      else
        // Get the union of update IDs.
        eventData[methods.update][type] = [ ...union(
          eventData[methods.update][type],
          relatedUpdates[type].map(mapId)) ]
    }

    // Summarize changes during the lifecycle of the request.
    this.emit(this.change, eventData)

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

  for (let update of updates) if (!(keys.primary in update))
    throw new errors.BadRequestError(
      `The required field "${keys.primary}" on the update is missing.`)
}


/**
 * Given a set of fields, record, and an update object, apply the update on a
 * cloned record. Note that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} fields
 * @param {Object} update
 * @return {Object}
 */
function applyUpdate (record, fields, update) {
  const clone = Object.assign({}, record)

  for (let key in update.replace) {
    clone[key] = update.replace[key]
  }

  for (let key in update.push) {
    clone[key] = clone[key].slice()
    if (Array.isArray(update.push[key]))
      clone[key].push(...update.push[key])
    else clone[key].push(update.push[key])
  }

  for (let key in update.pull) {
    clone[key] = clone[key].slice()
    .filter(exclude.bind(null,
      Array.isArray(update.pull[key]) ?
      update.pull[key] : [ update.pull[key] ]))
  }

  return clone
}


function exclude (values, value) {
  return !arrayProxy.includes(values, value)
}


function dropFields (update, fields) {
  for (let key in update.replace)
    if (!(key in fields)) delete update.replace[key]

  for (let key in update.push)
    if (!(key in fields)) delete update.push[key]

  for (let key in update.pull)
    if (!(key in fields)) delete update.pull[key]
}
