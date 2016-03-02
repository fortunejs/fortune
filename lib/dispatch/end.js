'use strict'

var map = require('../common/array/map')
var promise = require('../common/promise')


/**
 * Apply `output` transform per record, this mutates `context.response`.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var transforms = this.transforms
  var request = context.request
  var response = context.response
  var type = request.type
  var transform = transforms[type]
  var records = response.records
  var include = response.include

  // Delete temporary keys.
  delete response.records
  delete response.include

  // Delete this key as well, since the transaction should already be ended
  // at this point.
  delete context.transaction

  // Run transforms on primary type.
  return (records ? Promise.all(map(records, function (record) {
    return Promise.resolve(typeof transform[1] === 'function' ?
      transform[1](context, record) : record)
  }))

  .then(function (updatedRecords) {
    var includeTypes
    var i, j

    for (i = 0, j = updatedRecords.length; i < j; i++)
      records[i] = updatedRecords[i]

    if (!include) return void 0

    // The order of the keys and their corresponding indices matter. Since it
    // is an associative array, we are not guaranteed any particular order,
    // but the order that we get matters.
    includeTypes = Object.keys(include)

    // Run output transforms per include type.
    return Promise.all(map(includeTypes, function (includeType) {
      return Promise.all(map(include[includeType], function (record) {
        return Promise.resolve(
          typeof transforms[includeType][1] === 'function' ?
            transforms[includeType][1](context, record) : record)
      }))
    }))

    .then(function (types) {
      var include = {}
      var i, j

      for (i = 0, j = types.length; i < j; i++)
        include[includeTypes[i]] = types[i]

      return include
    })
  }) : Promise.resolve())

  .then(function (include) {
    context.response.payload = {
      records: records,
      include: include
    }

    if ('count' in records)
      context.response.payload.count = records.count

    return context
  })
}
