import checkLinks from '../../adapter/check_links'
import applyUpdate from '../../adapter/apply_update'
import validateUpdate from '../../adapter/validate_update'
import enforce from '../../schema/enforce'
import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'

/*!
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type, ids } = context.request
  const { adapter, serializer, events, schemas, transforms } = this
  const updates = serializer.parseUpdate(context)
  const relatedUpdates = {}
  let transaction

  if (!updates.length)
    throw new errors.BadRequestError(
      `There are no valid updates in the request.`)

  updates.forEach(update => {
    if (!~ids.indexOf(update[keys.primary]))
      throw new errors.BadRequestError(
        `An update is missing for at least one of the requested records.`)

    validateUpdate(update)
  })

  const schema = schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  return adapter.find(type, updates.map(update => {
    if (!(keys.primary in update))
      throw new errors.BadRequestError(
        `The required field "${keys.primary}" on the update is missing.`)

    return update[keys.primary]
  }))

  .then(records => Promise.all(records.map(record => {
    const update = arrayProxy.find(updates, update =>
      update[keys.primary] === record[keys.primary])

    if (!update)
      throw new errors.NotFoundError(
        `The record to be updated could not be found.`)

    // Apply updates to record.
    record = applyUpdate(record, schema, update)

    // Enforce the schema before running transform.
    record = enforce(record, schema)

    // Ensure referential integrity.
    return checkLinks(record, schema, links, adapter)

    // Do input transforms.
    .then(() => 'input' in (transforms[type] || {}) ?
      transforms[type].input(context, record) : null)
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
      if (!(linkedType in updates)) relatedUpdates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      const addIds = new Set()
      const removeIds = new Set()

      if (field in update.set) {
        const id = update.set[field]
        if (id !== null) addIds.add(id)
        else removeIds.add(id)
      }

      if (field in update.unset) {
        const id = update.unset[field]
        if (id !== null) removeIds.add(id)
      }

      if (field in update.push)
        update.push[field].forEach(id =>
          id !== null ? addIds.add(id) : null)

      if (field in update.pull)
        update.pull[field].forEach(id =>
          id !== null ? removeIds.add(id) : null)

      const findUpdate = id => {
        if (idCache[linkedType].has(id))
          return arrayProxy.find(relatedUpdates[linkedType],
            update => update.id === id)
        else {
          const relatedUpdate = { id }
          relatedUpdates[linkedType].push(relatedUpdate)
          idCache[linkedType].add(id)
          return relatedUpdate
        }
      }

      // Iterate over additive IDs.
      addIds.forEach(id => {
        if (!id) return

        const relatedUpdate = findUpdate(id)

        if (linkedIsArray) {
          if (!relatedUpdate.push) relatedUpdate.push = {}
          if (!relatedUpdate.push[inverseField])
            relatedUpdate.push[inverseField] = []
          relatedUpdate.push[inverseField].push(update[keys.primary])
        } else {
          if (!relatedUpdate.set) relatedUpdate.set = {}
          relatedUpdate.set[inverseField] = update[keys.primary]
        }
      })

      // Iterate over removing IDs.
      removeIds.forEach(id => {
        if (!id) return

        const relatedUpdate = findUpdate(id)

        if (linkedIsArray) {
          if (!relatedUpdate.pull) relatedUpdate.pull = {}
          if (!relatedUpdate.pull[inverseField])
            relatedUpdate.pull[inverseField] = []
          relatedUpdate.pull[inverseField].push(update[keys.primary])
        } else {
          if (!relatedUpdate.unset) relatedUpdate.unset = {}
          relatedUpdate.unset[inverseField] = true
        }
      })
    }))

    return Promise.all(Object.keys(relatedUpdates)
      .map(type => relatedUpdates[type].length ?
        transaction.update(type, relatedUpdates[type]) :
        Promise.resolve()))
  })

  .then(() => transaction.endTransaction())

  .then(() => {
    const eventData = {}

    // Summarize changes during the lifecycle of the request.
    this.emit(events.change, eventData)

    return context
  })
}
