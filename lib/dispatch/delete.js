'use strict'

var message = require('../common/message')
var promise = require('../common/promise')
var map = require('../common/array/map')

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError

var updateHelpers = require('./update_helpers')
var getUpdate = updateHelpers.getUpdate
var removeId = updateHelpers.removeId

var constants = require('../common/constants')
var changeEvent = constants.change
var deleteMethod = constants.delete
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray


/**
 * Delete records. This does not mutate context.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var self = this
  var Promise = promise.Promise
  var request = context.request
  var type = request.type
  var ids = request.ids
  var meta = request.meta
  var language = meta.language
  var adapter = self.adapter
  var recordTypes = self.recordTypes
  var hooks = self.hooks
  var updates = {}
  var fields = recordTypes[type]
  var hook = hooks[type]
  var links = []
  var transaction, field, records

  for (field in fields)
    if (linkKey in fields[field]) links.push(field)

  if (!ids || !ids.length)
    throw new NotFoundError(message('DeleteRecordsMissingID', language))

  return adapter.find(type, ids, null, meta)

  .then(function (foundRecords) {
    records = foundRecords

    if (records.length < ids.length)
      throw new NotFoundError(message('DeleteRecordsInvalid', language))

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    return adapter.beginTransaction()
  })

  .then(function (result) {
    context.transaction = transaction = result

    return typeof hook[0] === 'function' ?
      Promise.all(map(records, function (record) {
        return hook[0](context, record)
      })) : records
  })

  .then(function () {
    return transaction.delete(type, ids, meta)
  })

  .then(function (count) {
    var i, j, k, l, m, n, record, field, id, inverseField,
      linkedType, linkedIsArray, linkedIds

    // Remove all instances of the deleted IDs in all records.
    var idCache = {}

    // Sanity check.
    if (count < ids.length)
      throw new Error(message('DeleteRecordsFail', language))

    // Loop over each record to generate updates object.
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      for (k = 0, l = links.length; k < l; k++) {
        field = links[k]
        inverseField = fields[field][inverseKey]

        if (!(field in record) || !inverseField) continue

        linkedType = fields[field][linkKey]
        linkedIsArray = recordTypes[linkedType][inverseField][isArrayKey]
        linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        // Do some initialization.
        if (!updates[linkedType]) updates[linkedType] = []
        if (!idCache[linkedType]) idCache[linkedType] = {}

        for (m = 0, n = linkedIds.length; m < n; m++) {
          id = linkedIds[m]
          if (id !== null)
            removeId(record[primaryKey],
              getUpdate(linkedType, id, updates, idCache),
              inverseField, linkedIsArray)
        }
      }
    }

    return Promise.all(map(Object.keys(updates), function (type) {
      return updates[type].length ?
        transaction.update(type, updates[type], meta) :
        null
    }))
  })

  .then(function () {
    return transaction.endTransaction()
  })

  // This makes sure to call `endTransaction` before re-throwing the error.
  .catch(function (error) {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(function () {
    var eventData = {}, currentType

    eventData[deleteMethod] = {}
    eventData[deleteMethod][type] = ids

    for (currentType in updates) {
      if (!updates[currentType].length) continue
      if (!(updateMethod in eventData)) eventData[updateMethod] = {}
      eventData[updateMethod][currentType] = updates[currentType]
    }

    // Summarize changes during the lifecycle of the request.
    self.emit(changeEvent, eventData)

    return context
  })
}
