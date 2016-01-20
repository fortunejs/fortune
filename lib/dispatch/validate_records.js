'use strict'

var message = require('../common/message')
var includes = require('../common/array/includes')

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
  var i, j, k, value, field, record, id, ids, seen,
    fieldLink, fieldInverse, fieldIsArray, inverseIsArray

  for (i = links.length; i--;) {
    field = links[i]
    fieldLink = fields[field][linkKey]
    fieldInverse = fields[field][inverseKey]
    fieldIsArray = fields[field][isArrayKey]
    inverseIsArray = recordTypes[fieldLink][fieldInverse][isArrayKey]

    if (fieldIsArray)
      for (j = records.length; j--;) {
        record = records[j]
        if (!Array.isArray(record[field])) continue
        ids = record[field]
        seen = {}

        for (k = ids.length; k--;) {
          id = ids[k]
          if (id in seen) throw new ConflictError(
            message('CollisionDuplicate', language, { id: id, field: field }))
          else seen[id] = true
        }
      }

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
          else throw new ConflictError(
            message('CollisionToOne', language, { field: field }))
        }
      }
    }
  }
}
