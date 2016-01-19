'use strict'

var message = require('../common/message')
var pull = require('./array/pull')
var keys = require('./keys')
var linkKey = keys.link

var errors = require('../common/errors')
var ConflictError = errors.ConflictError


/**
 * Given a record and an update object, apply the update on the record. Note
 * that the `operate` object is unapplied here. Optionally, check if a `push`
 * contains conflicts for link fields.
 *
 * @param {Object} record
 * @param {Object} update
 * @param {Object} fields
 * @param {Object} meta
 */
module.exports = function applyUpdate (record, update, fields, meta) {
  var i, j, k, keys, field, value, values, seen, language

  if (update.replace) {
    keys = Object.keys(update.replace)
    for (i = keys.length; i--;) {
      field = keys[i]
      record[field] = update.replace[field]
    }
  }

  if (update.push) {
    keys = Object.keys(update.push)
    for (i = keys.length; i--;) {
      field = keys[i]
      value = update.push[field]

      // Check for uniqueness in array link field.
      if (fields && meta && field in fields &&
        fields[field][linkKey] && record[field]) {
        language = meta.language
        values = record[field].concat(value)
        seen = {}
        for (j = values.length; j--;) {
          k = values[j]
          if (k in seen) throw new ConflictError(
            message('CollisionPush', language, { field: field }))
          else seen[k] = true
        }
      }


      record[field] = record[field] ?
        record[field].concat(value) : [].concat(value)
    }
  }

  if (update.pull) {
    keys = Object.keys(update.pull)
    for (i = keys.length; i--;) {
      field = keys[i]
      value = update.pull[field]
      record[field] = record[field] ?
        pull(record[field], value) : []
    }
  }
}
