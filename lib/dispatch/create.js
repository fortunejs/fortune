'use strict'

var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var message = require('../common/message')
var promise = require('../common/promise')
var filter = require('../common/array/filter')
var map = require('../common/array/map')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var updateHelpers = require('./update_helpers')
var getUpdate = updateHelpers.getUpdate
var addId = updateHelpers.addId

var constants = require('../common/constants')
var changeEvent = constants.change
var createMethod = constants.create
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray
var denormalizedInverseKey = constants.denormalizedInverse


/**
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var self = this
  var Promise = promise.Promise
  var adapter = self.adapter
  var serializer = self.serializer
  var recordTypes = self.recordTypes
  var transforms = self.transforms
  var updates = {}
  var transaction, records, type, meta, transform, fields, links, language

  return serializer.parseCreate(context)

  .then(function (results) {
    var i, j, field, fieldsArray, record

    records = results

    if (!records || !records.length)
      throw new BadRequestError(message('CreateRecordsInvalid', language))

    type = context.request.type
    meta = context.request.meta
    language = meta.language

    transform = transforms[type]
    fields = recordTypes[type]
    fieldsArray = Object.keys(fields)
    links = filter(fieldsArray, function (field) {
      return fields[field][linkKey]
    })

    // Delete denormalized inverse fields.
    for (i = fieldsArray.length; i--;) {
      field = fieldsArray[i]
      if (fields[field][denormalizedInverseKey])
        for (j = records.length; j--;) {
          record = records[j]
          delete record[field]
        }
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

  .then(function (results) {
    records = results

    return Promise.all(map(records, function (record) {
      // Enforce the fields.
      enforce(type, record, fields, meta)

      // Ensure referential integrity.
      return checkLinks.call(self, record, fields, links, meta)
      .then(function () { return record })
    }))
  })

  .then(function (records) {
    validateRecords.call(self, records, fields, links, meta)
    return transaction.create(type, records, meta)
  })

  .then(function (createdRecords) {
    var i, j, k, record, field, inverseField,
      linkedType, linkedIsArray, linkedIds, id

    // Update inversely linked records on created records.
    // Trying to batch updates to be as few as possible.
    var idCache = Object.create(null)

    records = createdRecords

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    // Adapter must return something.
    if (!records.length)
      throw new BadRequestError(message('CreateRecordsFail', language))

    // Iterate over each record to generate updates object.
    for (i = records.length; i--;) {
      record = records[i]

      // Each created record must have an ID.
      if (!(primaryKey in record))
        throw new Error(message('CreateRecordMissingID', language))

      for (j = links.length; j--;) {
        field = links[j]
        inverseField = fields[field][inverseKey]

        if (!(field in record) || !inverseField) continue

        linkedType = fields[field][linkKey]
        linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]
        linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        // Do some initialization.
        if (!updates[linkedType]) updates[linkedType] = []
        if (!idCache[linkedType]) idCache[linkedType] = Object.create(null)

        for (k = linkedIds.length; k--;) {
          id = linkedIds[k]
          if (id !== null)
            addId(record[primaryKey],
              getUpdate(linkedType, id, updates, idCache),
              inverseField, linkedIsArray)
        }
      }
    }

    return Promise.all(map(Object.keys(updates),
      function (type) {
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
    eventData[createMethod] = {}
    eventData[createMethod][type] = map(records, function (record) {
      return record[primaryKey]
    })

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
