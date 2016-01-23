'use strict'

var pull = require('./array/pull')


/**
 * Given a record and an update object, apply the update on the record. Note
 * that the `operate` object is unapplied here.
 *
 * @param {Object} record
 * @param {Object} update
 */
module.exports = function applyUpdate (record, update) {
  var field

  for (field in update.replace)
    record[field] = update.replace[field]

  for (field in update.push)
    record[field] = record[field] ?
      record[field].concat(update.push[field]) :
      [].concat(update.push[field])

  for (field in update.pull)
    record[field] = record[field] ?
      pull(record[field], update.pull[field]) : []
}
