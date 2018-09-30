'use strict'

var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var message = require('../common/message')
var promise = require('../common/promise')
var map = require('../common/array/map')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var updateHelpers = require('./update_helpers')
var scrubDenormalizedUpdates = updateHelpers.scrubDenormalizedUpdates
var getUpdate = updateHelpers.getUpdate
var addId = updateHelpers.addId
var removeId = updateHelpers.removeId

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
  var Promise = promise.Promise
  var self = this
  var denormalizedFields = self.denormalizedFields
  var recordTypes = self.recordTypes
  var hooks = self.hooks
  var updates = {}
  var links = []
  var recordsLinked = []
  var transaction, records, type, meta, hook, fields, language

  // Start a promise chain.
  return Promise.resolve(context.request.payload)

    .then(function (payload) {
      var i, j, field

      records = payload

      if (!records || !records.length)
        throw new BadRequestError(
          message('CreateRecordsInvalid', language))

      type = context.request.type
      meta = context.request.meta
      transaction = context.transaction
      language = meta.language

      hook = hooks[type]
      fields = recordTypes[type]

      for (field in fields) {
        if (linkKey in fields[field])
          links.push(field)

        // Delete denormalized inverse fields.
        if (denormalizedInverseKey in fields[field])
          for (i = 0, j = records.length; i < j; i++)
            delete records[i][field]
      }

      return typeof hook[0] === 'function' ?
        Promise.all(map(records, function (record) {
          return hook[0](context, record)
        })) : records
    })

    .then(function (results) {
      return Promise.all(map(results, function (record, i) {
        if (record && typeof record === 'object') records[i] = record
        else record = records[i]

        // Enforce the fields.
        enforce(type, record, fields, meta)

        // Ensure referential integrity.
        return checkLinks.call(self, transaction, record, fields, links, meta)
          .then(function (linked) {
            // The created records should come back in the same order.
            recordsLinked.push(linked)
            return record
          })
      }))
    })

    .then(function () {
      validateRecords.call(self, records, fields, links, meta)
      return transaction.create(type, records, meta)
    })

    .then(function (createdRecords) {
      var record, field, inverseField, fieldIsArray,
        linked, linkedType, linkedIsArray, linkedIds, id,
        partialRecord, partialRecords
      var i, j, k, l, m, n, o, p

      // Update inversely linked records on created records.
      // Trying to batch updates to be as few as possible.
      var idCache = {}

      // Adapter must return something.
      if (!createdRecords.length)
        throw new BadRequestError(
          message('CreateRecordsFail', language))

      records = createdRecords

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      // Iterate over each record to generate updates object.
      for (i = 0, j = records.length; i < j; i++) {
        record = records[i]
        linked = recordsLinked[i]

        // Each created record must have an ID.
        if (!(primaryKey in record))
          throw new Error(
            message('CreateRecordMissingID', language))

        for (k = 0, l = links.length; k < l; k++) {
          field = links[k]
          inverseField = fields[field][inverseKey]

          if (!record.hasOwnProperty(field) || !inverseField) continue

          linkedType = fields[field][linkKey]
          linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]
          fieldIsArray = fields[field][isArrayKey]
          linkedIds = fieldIsArray ?
            record[field] : [ record[field] ]

          // Do some initialization.
          if (!updates[linkedType]) updates[linkedType] = []
          if (!idCache[linkedType]) idCache[linkedType] = {}

          for (m = 0, n = linkedIds.length; m < n; m++) {
            id = linkedIds[m]

            // Set related field.
            if (id !== null)
              addId(record[primaryKey],
                getUpdate(linkedType, id, updates, idCache),
                inverseField, linkedIsArray)

            // Unset 2nd degree related record for one-to-one case.
            if (!fieldIsArray &&
            linked[field] &&
            linked[field][inverseField] !== null &&
            !linkedIsArray &&
            linked[field][inverseField] !== record[primaryKey])
              removeId(id,
                getUpdate(
                  type, linked[field][inverseField], updates, idCache),
                field, linkedIsArray)
          }

          // Unset from 2nd degree related records for many-to-one case.
          if (fieldIsArray &&
          linked[field] && !linkedIsArray) {
            partialRecords = Array.isArray(linked[field]) ?
              linked[field] : [ linked[field] ]

            for (o = 0, p = partialRecords.length; o < p; o++) {
              partialRecord = partialRecords[o]

              if (partialRecord[inverseField] === record[primaryKey])
                continue

              removeId(partialRecord[primaryKey],
                getUpdate(
                  type, partialRecord[inverseField],
                  updates, idCache),
                field, fieldIsArray)
            }
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
      var eventData = {}, currentType

      eventData[createMethod] = {}
      eventData[createMethod][type] = records

      for (currentType in updates) {
        scrubDenormalizedUpdates(updates[currentType], denormalizedFields)

        if (!updates[currentType].length) continue

        if (!(updateMethod in eventData)) eventData[updateMethod] = {}
        eventData[updateMethod][currentType] = updates[currentType]
      }

      // Summarize changes during the lifecycle of the request.
      self.emit(changeEvent, eventData)

      return context
    })
}
