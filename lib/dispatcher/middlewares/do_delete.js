import primaryKey from '../../common/primary_key'
import * as keys from '../../schema/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'


/*!
 * Delete records. This does not mutate context.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type, ids } = context.request
  const updates = {}
  let transaction, records

  if (!ids.length)
    throw new errors.BadRequestError(
      `No IDs were specified to be deleted.`)

  return this.adapter.find(type, ids).then(records =>
    'before' in (this.transforms[type] || {}) ?
      records.map(record => this.transforms[type].before(context, record)) :
      records)

  .then(transformedRecords => {
    records = transformedRecords
    return this.adapter.beginTransaction()

  }).then(t => {
    transaction = t
    return transaction.delete(type, ids)

  }).then(() => {
    // Remove all instances of the deleted IDs in all records.
    const schema = this.schemas[type]
    const links = new Set(Object.keys(schema)
      .filter(field => schema[field][keys.link]))
    const idCache = {}

    // Do some initialization.
    links.forEach(field => {
      if (schema[field][keys.inverse]) {
        const linkedType = schema[field][keys.link]
        updates[linkedType] = []
        idCache[linkedType] = new Set()
      }
    })

    // Loop over each record to generate updates object.
    records.forEach(record => {
      links.forEach(field => {
        const inverseField = schema[field][keys.inverse]

        if (field in record && inverseField) {
          const linkedType = schema[field][keys.link]
          const linkedIsArray = this.schemas[linkedType]
            [inverseField][keys.isArray]
          const linkedIds = Array.isArray(record[field]) ?
            record[field]: [record[field]]

          linkedIds.forEach(id => {
            if (!id) return

            let update

            if (idCache[linkedType].has(id))
              update = arrayProxy.find(updates[linkedType],
                update => update.id === id)
            else {
              update = { id }
              updates[linkedType].push(update)
              idCache[linkedType].add(id)
            }

            if (linkedIsArray) {
              update.pull = update.pull || {}
              update.pull[inverseField] = update.pull[inverseField] || []
              update.pull[inverseField].push(record[primaryKey])
            } else {
              update.unset = update.unset || {}
              update.unset[inverseField] = true
            }
          })
        }
      })
    })

    return Promise.all(Object.keys(updates).map(type =>
      updates[type].length ?
        transaction.update(type, updates[type]) :
        Promise.resolve([])
    ))

  }).then(transaction.endTransaction)

  .then(() => {
    // Summarize changes during the lifecycle of the request.
    this.emit(this.changeEvent, Object.assign({
      [type]: {
        delete: ids
      }
    }, Object.keys(updates).reduce((types, type) => {
      if (updates[type].length)
        types[type] = {
          update: updates[type].map(update => update.id)
        }

      return types
    }, {})))

    return context
  })
}
