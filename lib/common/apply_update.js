'use strict'

var pull = require('./array/pull')


/**
 * Given a record and an update object, apply the update on the record. Note
 * that the `operate` object is unapplied here. Optionally, check if a `push`
 * contains conflicts for link fields.
 *
 * @param {Object} record
 * @param {Object} update
 */
module.exports = function applyUpdate (record, update) {
  var i, keys, field, value

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
