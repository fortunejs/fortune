'use strict'

var pull = require('./array/pull')


/**
 * Given a record and an update object, apply the update on the record. Note
 * that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} update
 */
module.exports = function applyUpdate (record, update) {
  var iterator, keys, field, value

  if (update.replace) {
    keys = Object.keys(update.replace)
    for (iterator = keys.length; iterator--;) {
      field = keys[iterator]
      record[field] = update.replace[field]
    }
  }

  if (update.push) {
    keys = Object.keys(update.push)
    for (iterator = keys.length; iterator--;) {
      field = keys[iterator]
      value = update.push[field]
      record[field] = record[field] ?
        record[field].concat(value) : [].concat(value)
    }
  }

  if (update.pull) {
    keys = Object.keys(update.pull)
    for (iterator = keys.length; iterator--;) {
      field = keys[iterator]
      value = update.pull[field]
      record[field] = record[field] ?
        pull(record[field], value) : []
    }
  }
}
