import deepEqual from 'deep-equal'
import clone from 'clone'
import validateRecords from './validate_records'
import checkLinks from './check_links'
import enforce from '../record_type/enforce'
import applyUpdate from '../common/apply_update'
import change from '../common/change'
import { update as updateMethod } from '../common/methods'
import {
  primary as primaryKey,
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey,
  denormalizedInverse as denormalizedInverseKey
} from '../common/keys'
import { NotFoundError, BadRequestError } from '../common/errors'
import { find, includes } from '../common/array_proxy'
import deepEqualOptions from '../common/deep_equal_options'


/**
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { adapter, serializer, recordTypes, transforms } = this

  // Keyed by update, valued by record.
  const updateMap = new WeakMap()

  // Keyed by update, valued by hash of linked records.
  const linkedMap = new WeakMap()

  const relatedUpdates = {}
  const transformedUpdates = []

  let transaction
  let updates
  let type
  let meta
  let fields
  let transform
  let links

  return serializer.parseUpdate(context)

  .then(results => {
    updates = results

    validateUpdates(updates)

    ; ({ request: { type, meta } } = context)
    fields = recordTypes[type]
    transform = transforms[type]
    links = Object.keys(fields).filter(field => fields[field][linkKey])

    // Delete denormalized inverse fields, can't be updated.
    for (let field in fields)
      if (fields[field][denormalizedInverseKey])
        for (let update of updates) {
          if ('replace' in update) delete update.replace[field]
          if ('push' in update) delete update.push[field]
          if ('pull' in update) delete update.pull[field]
        }

    return adapter.find(type, updates.map(update => update.id), null, meta)
  })

  .then(records => Promise.all(records.map(record => {
    const update = find(updates, update =>
      update.id === record[primaryKey])

    if (!update) throw new NotFoundError(
      `The record to be updated could not be found.`)

    const cloneUpdate = clone(update)

    return Promise.resolve(transform && transform.input ?
      transform.input(context, clone(record), update) : update)
    .then(update => {
      if (!deepEqual(update, cloneUpdate, deepEqualOptions))
        Object.defineProperty(context.response,
          'updateModified', { value: true })

      transformedUpdates.push(update)
      updateMap.set(update, record)

      // Clone the record (again).
      record = clone(record)

      // Apply updates to record.
      applyUpdate(record, update)

      // Apply operators to record.
      if ('operate' in update)
        record = adapter.applyOperators(record, update.operate)

      // Enforce the fields.
      enforce(type, record, fields)

      // Ensure referential integrity.
      return checkLinks.call(this, record, fields, links, meta)
      .then(linked => {
        linkedMap.set(update, linked)
        return record
      })
    })
  })))

  .then(records => validateRecords.call(this, records, fields, links))

  .then(records => {
    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    return adapter.beginTransaction()
  })

  .then(t => {
    transaction = t

    // Drop fields in the updates that aren't defined in the record type
    // before doing the update.
    for (let update of transformedUpdates)
      dropFields(update, fields)

    return transaction.update(type, transformedUpdates, meta)
  })

  .then(() => {
    // Build up related updates based on update objects.
    const idCache = {}

    // Iterate over each update to generate related updates.
    for (let update of transformedUpdates)
      for (let field of links) {
        const inverseField = fields[field][inverseKey]

        if (!inverseField) continue

        const isArray = fields[field][isArrayKey]
        const linkedType = fields[field][linkKey]
        const linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]

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
              addId(update.id,
                getUpdate(linkedType, id, relatedUpdates, idCache),
                inverseField, linkedIsArray)

            // Unset 2nd degree related record.
            if (linked[field] &&
              linked[field][inverseField] !== null &&
              !linkedIsArray &&
              linked[field][inverseField] !== update.id)
              removeId(id,
                getUpdate(
                  linkedType, linked[field][inverseField],
                  relatedUpdates, idCache),
                inverseField, linkedIsArray)

            // For unsetting, remove ID from related record.
            if (record[field] !== null &&
              record[field] !== update[field] &&
              record[field] !== id)
              removeId(update.id,
                getUpdate(
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
          for (let id of ids)
            if (!includes(record[field], id))
              update.push[field].push(id)

          for (let id of record[field])
            if (!includes(ids, id))
              update.pull[field].push(id)
        }

        if (update.push && field in update.push) {
          const push = Array.isArray(update.push[field]) ?
            update.push[field] : [ update.push[field] ]

          for (let id of push)
            if (id !== null)
              addId(update.id,
                getUpdate(linkedType, id, relatedUpdates, idCache),
                inverseField, linkedIsArray)
        }

        if (update.pull && field in update.pull) {
          const pull = Array.isArray(update.pull[field]) ?
            update.pull[field] : [ update.pull[field] ]

          for (let id of pull)
            if (id !== null)
              removeId(update.id,
                getUpdate(linkedType, id, relatedUpdates, idCache),
                inverseField, linkedIsArray)
        }

        // Unset from 2nd degree related records.
        if (linked[field] && !linkedIsArray) {
          const partialRecords = Array.isArray(linked[field]) ?
            linked[field] : [ linked[field] ]

          for (let partialRecord of partialRecords) {
            if (partialRecord[inverseField] === update.id) continue

            removeId(partialRecord.id,
              getUpdate(
                type, partialRecord[inverseField],
                relatedUpdates, idCache),
              field, isArray)
          }
        }
      }

    return Promise.all(Object.keys(relatedUpdates)
      .map(type => relatedUpdates[type].length ?
        transaction.update(type, relatedUpdates[type], meta) :
        null))
  })

  .then(() => transaction.endTransaction())

  .catch(error => {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(() => {
    const mapId = update => update.id

    const eventData = {
      [updateMethod]: {
        [type]: transformedUpdates.map(update => update.id)
      }
    }

    for (let linkedType in relatedUpdates) {
      if (!relatedUpdates[linkedType].length) continue
      if (linkedType !== type)
        eventData[updateMethod][linkedType] =
          relatedUpdates[linkedType].map(mapId)

      // Get the union of update IDs.
      else eventData[updateMethod][type] = [ ...union(
        eventData[updateMethod][type],
        relatedUpdates[type].map(mapId)) ]
    }

    // Summarize changes during the lifecycle of the request.
    this.emit(change, eventData)

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
    throw new BadRequestError(
      `There are no valid updates in the request.`)

  for (let update of updates)
    if (!(primaryKey in update))
      throw new BadRequestError(
        `The required field "${primaryKey}" on the update is missing.`)
}


function dropFields (update, fields) {
  for (let field in update.replace)
    if (!(field in fields)) delete update.replace[field]

  for (let field in update.push)
    if (!(field in fields)) delete update.push[field]

  for (let field in update.pull)
    if (!(field in fields)) delete update.pull[field]
}


// Get a related update object by ID, or return a new one if not found.
function getUpdate (type, id, updates, cache) {
  if ('type' in cache && cache[type].has(id))
    return find(updates[type],
      update => update[primaryKey] === id)

  const update = { id }
  updates[type].push(update)
  cache[type].add(id)
  return update
}


// Add an ID to an update object.
function addId (id, update, field, isArray) {
  if (isArray) {
    if (!update.push) update.push = {}
    if (!update.push[field]) update.push[field] = []
    update.push[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = id
}


// Remove an ID from an update object.
function removeId (id, update, field, isArray) {
  if (isArray) {
    if (!update.pull) update.pull = {}
    if (!update.pull[field]) update.pull[field] = []
    update.pull[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = null
}
