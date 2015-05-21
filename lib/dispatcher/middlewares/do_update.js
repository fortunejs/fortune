import checkLinks from '../check_links'
import enforce from '../../schema/enforce'
import * as keys from '../../common/reserved_keys'
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
  const { methods, adapter, serializer, schemas, transforms } = this
  const updates = serializer.parseUpdate(context)

  // Keyed by update, valued by record.
  const updateMap = new WeakMap()

  // Keyed by update, valued by object with fields valued by linked records.
  const linkedMap = new WeakMap()

  const { type } = context.request
  const schema = schemas[type]
  const transform = transforms[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  const relatedUpdates = {}
  let transaction

  validateUpdates(updates)

  // Delete denormalized inverse fields.
  for (let field in schema) {
    if (keys.denormalizedInverse in schema[field])
      for (let update of updates) {
        if ('replace' in update) delete update.replace[field]
        if ('push' in update) delete update.push[field]
        if ('pull' in update) delete update.pull[field]
      }
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
    record = applyUpdate(record, schema, update)

    // Apply operators to record.
    if ('operate' in update)
      record = adapter.applyOperators(record, update.operate)

    // Enforce the schema before running transform.
    record = enforce(type, record, schema)

    // Ensure referential integrity.
    return checkLinks(record, schema, links, adapter)

    // Do input transforms.
    .then(linked => {
      linkedMap.set(update, linked)
      return transform && 'input' in transform ?
        transform.input(context, record) : record
    })
  })))

  .then(transformedRecords => {
    // Enforce the schema after transform.
    transformedRecords = transformedRecords.map(record =>
      enforce(type, record, schema))

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: transformedRecords
    })

    return adapter.beginTransaction()
  })

  .then(t => {
    transaction = t

    // Drop fields in the updates that aren't in the schema.
    updates.forEach(update => dropFields(update, schema))

    return transaction.update(type, updates)
  })

  .then(() => {
    // Build up related updates based on update objects.
    const idCache = {}

    // Iterate over each update to generate related updates.
    updates.forEach(update => links.forEach(field => {
      const inverseField = schema[field][keys.inverse]

      if (!inverseField) return

      const isArray = schema[field][keys.isArray]
      const linkedType = schema[field][keys.link]
      const linkedIsArray = schemas[linkedType][inverseField][keys.isArray]

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
          return
        }

        const ids = id

        // Initialize array.
        if (!update.push) update.push = {}
        if (!update.pull) update.pull = {}
        update.push[field] = []
        update.pull[field] = []

        // Compute differences, and mutate the update.
        ids.forEach(id => !arrayProxy.includes(record[field], id) ?
          update.push[field].push(id) : null)
        record[field].forEach(id => !arrayProxy.includes(ids, id) ?
          update.pull[field].push(id) : null)
      }

      if (update.push && field in update.push) {
        const push = Array.isArray(update.push[field]) ?
          update.push[field] : [update.push[field]]

        push.forEach(id => id !== null ?
          updateHelpers.addId(update.id,
            updateHelpers.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)
      }

      if (update.pull && field in update.pull) {
        const pull = Array.isArray(update.pull[field]) ?
          update.pull[field] : [update.pull[field]]

        pull.forEach(id => id !== null ?
          updateHelpers.removeId(update.id,
            updateHelpers.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)
      }

      // Unset from 2nd degree related records.
      if (linked[field] && !linkedIsArray)
        (Array.isArray(linked[field]) ? linked[field] : [linked[field]])
        .forEach(partialRecord => {
          if (partialRecord[inverseField] === update.id) return

          updateHelpers.removeId(partialRecord.id,
            updateHelpers.getUpdate(
              type, partialRecord[inverseField],
              relatedUpdates, idCache),
            field, isArray)
        })
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
      [methods.update]: {
        [type]: updates.map(update => update.id)
      }
    }

    Object.keys(relatedUpdates).forEach(linkedType => {
      if (!relatedUpdates[linkedType].length) return
      if (!(methods.update in eventData)) eventData[methods.update] = {}
      if (linkedType !== type)
        eventData[methods.update][linkedType] =
          relatedUpdates[linkedType].map(update => update.id)
      else
        // Get the union of update IDs.
        eventData[methods.update][type] = [...union(
          eventData[methods.update][type],
          relatedUpdates[type].map(update => update.id))]
    })

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

  updates.forEach(update => {
    if (!(keys.primary in update))
      throw new errors.BadRequestError(
        `The required field "${keys.primary}" on the update is missing.`)
  })
}


/**
 * Given a schema, record, and an update object, apply the update on a cloned
 * record. Note that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} schema
 * @param {Object} update
 * @return {Object}
 */
function applyUpdate (record, schema, update) {
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
      update.pull[key] : [update.pull[key]]))
  }

  return clone
}


function exclude (values, value) {
  return !arrayProxy.includes(values, value)
}


function dropFields (update, schema) {
  for (let key in update.replace)
    if (!(key in schema)) delete update.replace[key]

  for (let key in update.push)
    if (!(key in schema)) delete update.push[key]

  for (let key in update.pull)
    if (!(key in schema)) delete update.pull[key]
}
