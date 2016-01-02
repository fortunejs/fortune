'use strict'

var message = require('../common/message')
var includes = require('../common/array/includes')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var linkKey = keys.link
var isArrayKey = keys.isArray
var inverseKey = keys.inverse

/**
 * Do some validation on records to be created or updated to determine
 * if there are any records which have overlapping to-one relationships.
 *
 * @param {Object[]} records
 * @param {Object} fields
 * @param {Object} links
 * @param {Object} meta
 */
module.exports = function validateRecords (records, fields, links, meta) {
  var recordTypes = this.recordTypes
  var language = meta.language
  var toOneMap = {}
  var i, j, k, value, field, record, id, ids,
    fieldLink, fieldInverse, inverseIsArray

  for (i = links.length; i--;) {
    field = links[i]
    fieldLink = fields[field][linkKey]
    fieldInverse = fields[field][inverseKey]
    inverseIsArray = recordTypes[fieldLink][fieldInverse][isArrayKey]

    if (!inverseIsArray) {
      toOneMap[field] = []

      for (j = records.length; j--;) {
        record = records[j]
        value = record[field]
        ids = Array.isArray(value) ? value : value ? [ value ] : []

        for (k = ids.length; k--;) {
          id = ids[k]
          if (!includes(toOneMap[field], id))
            toOneMap[field][toOneMap[field].length] = id
          else throw new BadRequestError(
            message('CollisionToOne', language, { field: field }))
        }
      }
    }
  }
}
