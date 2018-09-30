'use strict'

var deepEqual = require('../common/deep_equal')
var promise = require('../common/promise')
var assign = require('../common/assign')
var clone = require('../common/clone')
var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var message = require('../common/message')
var applyUpdate = require('../common/apply_update')

var updateHelpers = require('./update_helpers')
var scrubDenormalizedUpdates = updateHelpers.scrubDenormalizedUpdates
var getUpdate = updateHelpers.getUpdate
var addId = updateHelpers.addId
var removeId = updateHelpers.removeId

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError
var BadRequestError = errors.BadRequestError

var find = require('../common/array/find')
var includes = require('../common/array/includes')
var map = require('../common/array/map')

var constants = require('../common/constants')
var changeEvent = constants.change
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray
var denormalizedInverseKey = constants.denormalizedInverse
var updateRecordKey = constants.updateRecord
var linkedHashKey = constants.linkedHash


/**
 * Do updates. First, it must find the records to update, then run hooks
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var self = this
  var denormalizedFields = self.denormalizedFields
  var adapter = self.adapter
  var recordTypes = self.recordTypes
  var hooks = self.hooks

  var relatedUpdates = {}
  var hookedUpdates = []

  var links = []
  var transaction, updates, fields, hook, type, meta, language

  // Start a promise chain.
  return Promise.resolve(context.request.payload)

    .then(function (payload) {
      var i, j, update, field

      updates = payload
      validateUpdates(updates, context.request.meta)

      type = context.request.type
      meta = context.request.meta
      transaction = context.transaction
      language = meta.language

      fields = recordTypes[type]
      hook = hooks[type]

      // Delete denormalized inverse fields, can't be updated.
      for (field in fields) {
        if (linkKey in fields[field]) links.push(field)
        if (denormalizedInverseKey in fields[field])
          for (i = 0, j = updates.length; i < j; i++) {
            update = updates[i]
            if (update.replace) delete update.replace[field]
            if (update.pull) delete update.pull[field]
            if (update.push) delete update.push[field]
          }
      }

      return transaction.find(type, map(updates, function (update) {
        return update[primaryKey]
      }), null, meta)
    })

    .then(function (records) {
      if (records.length < updates.length)
        throw new NotFoundError(message('UpdateRecordMissing', language))

      return Promise.all(map(records, function (record) {
        var update, cloneUpdate
        var hasHook = typeof hook[0] === 'function'
        var id = record[primaryKey]

        update = find(updates, function (update) {
          return update[primaryKey] === id
        })

        if (!update) throw new NotFoundError(
          message('UpdateRecordMissing', language))

        if (hasHook) cloneUpdate = clone(update)

        return Promise.resolve(hasHook ?
          hook[0](context, record, update) : update)
          .then(function (result) {
            if (result && typeof result === 'object') update = result

            if (hasHook) {
              // Check if the update has been modified or not.
              if (!deepEqual(update, cloneUpdate))
                context.response.meta.updateModified = true

              // Runtime safety check: primary key must be the same.
              if (update[primaryKey] !== id) throw new BadRequestError(
                message('InvalidID', language))
            }

            hookedUpdates.push(update)
            Object.defineProperty(update, updateRecordKey, { value: record })

            // Shallow clone the record.
            record = assign({}, record)

            // Apply updates to record.
            applyUpdate(record, update)

            // Apply operators to record.
            if (update.operate)
              record = adapter.applyOperators(record, update.operate)

            // Enforce the fields.
            enforce(type, record, fields, meta)

            // Ensure referential integrity.
            return checkLinks.call(
              self, transaction, record, fields, links, meta)
              .then(function (linked) {
                Object.defineProperty(update, linkedHashKey, { value: linked })
                return record
              })
          })
      }))
    })

    .then(function (records) {
      var i, j

      validateRecords.call(self, records, fields, links, meta)

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      // Drop fields in the updates that aren't defined in the record type
      // before doing the update.
      for (i = 0, j = hookedUpdates.length; i < j; i++)
        dropFields(hookedUpdates[i], fields)

      return transaction.update(type, hookedUpdates, meta)
    })

    .then(function () {
      var inverseField, isArray, linkedType, linkedIsArray, linked, record,
        partialRecord, partialRecords, ids, id, push, pull, update, field
      var i, j, k, l, m, n

      // Build up related updates based on update objects.
      var idCache = {}

      // Iterate over each update to generate related updates.
      for (i = 0, j = hookedUpdates.length; i < j; i++) {
        update = hookedUpdates[i]

        for (k = 0, l = links.length; k < l; k++) {
          field = links[k]
          inverseField = fields[field][inverseKey]

          if (!inverseField) continue

          isArray = fields[field][isArrayKey]
          linkedType = fields[field][linkKey]
          linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]

          // Do some initialization.
          if (!relatedUpdates[linkedType]) relatedUpdates[linkedType] = []
          if (!idCache[linkedType]) idCache[linkedType] = {}

          record = update[updateRecordKey]
          linked = update[linkedHashKey]

          // Replacing a link field is pretty complicated.
          if (update.replace && update.replace.hasOwnProperty(field)) {
            id = update.replace[field]

            if (!Array.isArray(id)) {
            // Don't need to worry about inverse updates if the value does not
            // change.
              if (id === record[field]) continue

              // Set related field.
              if (id !== null)
                addId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)

              // Unset 2nd degree related record.
              if (linked[field] &&
              linked[field][inverseField] !== null &&
              !linkedIsArray &&
              linked[field][inverseField] !== update[primaryKey])
                removeId(id,
                  getUpdate(
                    type, linked[field][inverseField],
                    relatedUpdates, idCache),
                  field, linkedIsArray)

              // For unsetting, remove ID from related record.
              if (record[field] !== null &&
              record[field] !== update[field] &&
              record[field] !== id)
                removeId(update[primaryKey],
                  getUpdate(
                    linkedType, record[field], relatedUpdates, idCache),
                  inverseField, linkedIsArray)

              // After this point, there's no need to go over push/pull.
              continue
            }

            ids = id

            // Compute differences for pull, and mutate the update.
            for (m = 0, n = record[field].length; m < n; m++) {
              id = record[field][m]
              if (!includes(ids, id)) {
                if (!('pull' in update)) update.pull = {}
                if (update.pull.hasOwnProperty(field)) {
                  if (Array.isArray(update.pull[field])) {
                    update.pull[field].push(id)
                    continue
                  }
                  update.pull[field] = [ update.pull[field], id ]
                  continue
                }
                update.pull[field] = [ id ]
              }
            }

            // Compute differences for push, and mutate the update.
            for (m = 0, n = ids.length; m < n; m++) {
              id = ids[m]
              if (!includes(record[field], id)) {
                if (!('push' in update)) update.push = {}
                if (update.push.hasOwnProperty(field)) {
                  if (Array.isArray(update.push[field])) {
                    update.push[field].push(id)
                    continue
                  }
                  update.push[field] = [ update.push[field], id ]
                  continue
                }
                update.push[field] = [ id ]
              }
            }

            // Delete the original replace, since it is no longer valid.
            delete update.replace[field]
          }

          if (update.pull && update.pull[field]) {
            pull = Array.isArray(update.pull[field]) ?
              update.pull[field] : [ update.pull[field] ]

            for (m = 0, n = pull.length; m < n; m++) {
              id = pull[m]
              if (id !== null)
                removeId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)
            }
          }

          if (update.push && update.push[field]) {
            push = Array.isArray(update.push[field]) ?
              update.push[field] : [ update.push[field] ]

            for (m = 0, n = push.length; m < n; m++) {
              id = push[m]
              if (id !== null)
                addId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)
            }
          }

          // Unset from 2nd degree related records.
          if (linked[field] && !linkedIsArray) {
            partialRecords = Array.isArray(linked[field]) ?
              linked[field] : [ linked[field] ]

            for (m = 0, n = partialRecords.length; m < n; m++) {
              partialRecord = partialRecords[m]

              if (partialRecord[inverseField] === update[primaryKey])
                continue

              removeId(partialRecord[primaryKey],
                getUpdate(
                  type, partialRecord[inverseField],
                  relatedUpdates, idCache),
                field, isArray)
            }
          }
        }
      }

      return Promise.all(map(Object.keys(relatedUpdates), function (type) {
        return relatedUpdates[type].length ?
          transaction.update(type, relatedUpdates[type], meta) :
          null
      }))
    })

    .then(function () {
      var eventData = {}, linkedType

      eventData[updateMethod] = {}
      eventData[updateMethod][type] = hookedUpdates

      for (linkedType in relatedUpdates) {
        scrubDenormalizedUpdates(
          relatedUpdates[linkedType], denormalizedFields)

        if (!relatedUpdates[linkedType].length) continue

        if (linkedType !== type)
          eventData[updateMethod][linkedType] = relatedUpdates[linkedType]

        // Get the union of update IDs.
        else eventData[updateMethod][type] =
        eventData[updateMethod][type].concat(relatedUpdates[type])
      }

      // Summarize changes during the lifecycle of the request.
      self.emit(changeEvent, eventData)

      return context
    })
}


// Validate updates.
function validateUpdates (updates, meta) {
  var language = meta.language
  var i, j, update

  if (!updates || !updates.length)
    throw new BadRequestError(
      message('UpdateRecordsInvalid', language))

  for (i = 0, j = updates.length; i < j; i++) {
    update = updates[i]
    if (!update[primaryKey])
      throw new BadRequestError(
        message('UpdateRecordMissingID', language))
  }
}


function dropFields (update, fields) {
  var field

  for (field in update.replace)
    if (!fields.hasOwnProperty(field)) delete update.replace[field]

  for (field in update.pull)
    if (!fields.hasOwnProperty(field)) delete update.pull[field]

  for (field in update.push)
    if (!fields.hasOwnProperty(field)) delete update.push[field]
}
