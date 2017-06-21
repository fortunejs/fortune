'use strict'

var message = require('../common/message')
var promise = require('../common/promise')
var unique = require('../common/array/unique')
var map = require('../common/array/map')
var includes = require('../common/array/includes')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var primaryKey = keys.primary
var linkKey = keys.link
var isArrayKey = keys.isArray
var inverseKey = keys.inverse

module.exports = checkLinks


/**
 * Ensure referential integrity by checking if related records exist.
 *
 * @param {Object} transaction
 * @param {Object} record
 * @param {Object} fields
 * @param {String[]} links - An array of strings indicating which fields are
 * links. Need to pass this so that it doesn't get computed each time.
 * @param {Object} [meta]
 * @return {Promise}
 */
function checkLinks (transaction, record, fields, links, meta) {
  var Promise = promise.Promise
  var enforceLinks = this.options.settings.enforceLinks

  return Promise.all(map(links, function (field) {
    var ids = Array.isArray(record[field]) ? record[field] :
      !record.hasOwnProperty(field) || record[field] === null ?
        [] : [ record[field] ]
    var fieldLink = fields[field][linkKey]
    var fieldInverse = fields[field][inverseKey]
    var findOptions = { fields: {} }

    // Don't need the entire records.
    findOptions.fields[fieldInverse] = true

    return new Promise(function (resolve, reject) {
      if (!ids.length) return resolve()

      return transaction.find(fieldLink, ids, findOptions, meta)

        .then(function (records) {
          var recordIds, i, j

          if (enforceLinks) {
            recordIds = unique(map(records, function (record) {
              return record[primaryKey]
            }))

            for (i = 0, j = ids.length; i < j; i++)
              if (!includes(recordIds, ids[i]))
                return reject(new BadRequestError(
                  message('RelatedRecordNotFound', meta.language,
                    { field: field })
                ))
          }

          return resolve(records)
        })
    })
  }))

    .then(function (partialRecords) {
      var object = {}, records, i, j

      for (i = 0, j = partialRecords.length; i < j; i++) {
        records = partialRecords[i]

        if (records) object[links[i]] =
        fields[links[i]][isArrayKey] ? records : records[0]
      }

      return object
    })
}
