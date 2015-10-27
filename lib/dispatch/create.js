'use strict'

var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var filter = require('../common/array/filter')
var map = require('../common/array/map')
var find = require('../common/array/find')

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
  var adapter = self.adapter
  var serializer = self.serializer
  var recordTypes = self.recordTypes
  var transforms = self.transforms
  var updates = Object.create(null)

  var transaction
  var records
  var type
  var meta
  var transform
  var fields
  var links

  return serializer.parseCreate(context)

  .then(function (results) {
    var i, j, field, fieldsArray, record

    records = results

    if (!records || !records.length)
      throw new BadRequestError(
        'There are no valid records in the request.')

    type = context.request.type
    meta = context.request.meta
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

    return (transform && transform.input ?
      Promise.all(map(records, function (record) {
        return transform.input(context, record)
      })) : Promise.resolve(records))
  })

  .then(function (records) {
    return Promise.all(map(records, function (record) {
      // Enforce the fields.
      enforce(type, record, fields)

      // Ensure referential integrity.
      return checkLinks.call(self, record, fields, links, meta)
      .then(function () { return record })
    }))
  })

  .then(function (records) {
    return validateRecords.call(self, records, fields, links)
  })

  .then(function () {
    return adapter.beginTransaction()
  })

  .then(function (t) {
    transaction = t
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
      throw new BadRequestError('Records could not be created.')

    // Each created record must have an ID.
    if (find(records, function (record) {
      return !(primaryKey in record)
    })) throw new Error('An ID on a created record is missing.')

    // Iterate over each record to generate updates object.
    for (i = records.length; i--;) {
      record = records[i]
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

  .catch(function (error) {
    if (transaction) transaction.endTransaction(error)
    throw error
  })

  .then(function () {
    var keys = Object.keys(updates)
    var i, j

    var eventData = Object.create(null)
    eventData[createMethod] = Object.create(null)
    eventData[createMethod][type] = map(records, function (record) {
      return record[primaryKey]
    })

    for (i = keys.length; i--;) {
      j = keys[i]
      if (!updates[j].length) continue
      if (!eventData[updateMethod])
        eventData[updateMethod] = Object.create(null)
      eventData[updateMethod][j] = map(updates[j], mapId)
    }

    // Summarize changes during the lifecycle of the request.
    self.emit(changeEvent, eventData)

    return context
  })
}


function mapId (update) {
  return update[primaryKey]
}
