'use strict'

var message = require('../common/message')
var promise = require('../common/promise')
var filter = require('../common/array/filter')
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
  var transforms = self.transforms

  var updates = {}
  var fields = recordTypes[type]
  var transform = transforms[type]
  var links = filter(Object.keys(fields), function (field) {
    return fields[field][linkKey]
  })

  var transaction
  var records

  return (ids ? adapter.find(type, ids, null, meta) : Promise.resolve([]))

  .then(function (foundRecords) {
    records = foundRecords

    if (ids) {
      if (!records.length)
        throw new NotFoundError(message('DeleteRecordsInvalid', language))

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })
    }

    return adapter.beginTransaction()
  })

  .then(function (result) {
    context.transaction = transaction = result

    return transform && transform.input ?
      Promise.all(map(records, function (record) {
        return transform.input(context, record)
      })) : records
  })

  .then(function () {
    return transaction.delete(type, ids, meta)
  })

  .then(function () {
    var i, j, k, record, field, id, inverseField,
      linkedType, linkedIsArray, linkedIds

    // Remove all instances of the deleted IDs in all records.
    var idCache = Object.create(null)

    // Loop over each record to generate updates object.
    for (i = records.length; i--;) {
      record = records[i]
      for (j = links.length; j--;) {
        field = links[j]
        inverseField = fields[field][inverseKey]

        if (!(field in record) || !inverseField) continue

        linkedType = fields[field][linkKey]
        linkedIsArray = recordTypes[linkedType][inverseField][isArrayKey]
        linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        // Do some initialization.
        if (!updates[linkedType]) updates[linkedType] = []
        if (!idCache[linkedType]) idCache[linkedType] = Object.create(null)

        for (k = linkedIds.length; k--;) {
          id = linkedIds[k]
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
    var i, keys, currentType, eventData

    keys = Object.keys(updates)
    eventData = {}
    eventData[deleteMethod] = {}
    eventData[deleteMethod][type] = ids

    for (i = keys.length; i--;) {
      currentType = keys[i]
      if (!updates[currentType].length) continue
      if (!(updateMethod in eventData))
        eventData[updateMethod] = {}
      eventData[updateMethod][currentType] =
        map(updates[currentType], mapId)
    }

    // Summarize changes during the lifecycle of the request.
    self.emit(changeEvent, eventData)

    return context
  })
}


function mapId (update) {
  return update[primaryKey]
}
