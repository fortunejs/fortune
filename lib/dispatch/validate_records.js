'use strict'

var message = require('../common/message')

var errors = require('../common/errors')
var ConflictError = errors.ConflictError

var keys = require('../common/keys')
var linkKey = keys.link
var isArrayKey = keys.isArray
var inverseKey = keys.inverse

/**
 * Do some validation on records to be created or updated to determine
 * if there are any records which have overlapping to-one relationships,
 * or non-unique array relationships.
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
  var i, j, k, l, m, n, value, field, record, id, ids, seen,
    fieldLink, fieldInverse, fieldIsArray, inverseIsArray

  for (i = 0, j = links.length; i < j; i++) {
    field = links[i]
    fieldLink = fields[field][linkKey]
    fieldInverse = fields[field][inverseKey]
    fieldIsArray = fields[field][isArrayKey]
    inverseIsArray = recordTypes[fieldLink][fieldInverse][isArrayKey]

    if (fieldIsArray)
      for (k = 0, l = records.length; k < l; k++) {
        record = records[k]
        if (!Array.isArray(record[field])) continue
        ids = record[field]
        seen = {}

        for (m = 0, n = ids.length; m < n; m++) {
          id = ids[m]
          if (seen.hasOwnProperty(id)) throw new ConflictError(
            message('CollisionDuplicate', language, { id: id, field: field }))
          else seen[id] = true
        }
      }

    if (!inverseIsArray) {
      toOneMap[field] = {}

      for (k = 0, l = records.length; k < l; k++) {
        record = records[k]
        value = record[field]
        ids = Array.isArray(value) ? value : value ? [ value ] : []

        for (m = 0, n = ids.length; m < n; m++) {
          id = ids[m]
          if (!toOneMap[field].hasOwnProperty(id)) toOneMap[field][id] = true
          else throw new ConflictError(
            message('CollisionToOne', language, { field: field }))
        }
      }
    }
  }
}
