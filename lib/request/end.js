'use strict'

var map = require('../common/array/map')
var promise = require('../common/promise')
var assign = require('../common/assign')


/**
 * Apply `output` hook per record, this mutates `context.response`.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var hooks = this.hooks
  var request = context.request
  var response = context.response
  var type = request.type
  var hook = hooks[type]
  var records = response.records
  var include = response.include

  // Run hooks on primary type.
  return (records ? Promise.all(map(records, function (record) {
    return Promise.resolve(typeof hook[1] === 'function' ?
      hook[1](context, record) : record)
  }))

    .then(function (updatedRecords) {
      var includeTypes
      var i, j

      for (i = 0, j = updatedRecords.length; i < j; i++)
        if (updatedRecords[i]) records[i] = updatedRecords[i]

      if (!include) return void 0

      // The order of the keys and their corresponding indices matter.
      includeTypes = Object.keys(include)

      // Run output hooks per include type.
      return Promise.all(map(includeTypes, function (includeType) {
        // This is useful for output hooks to know which type that the current
        // record belongs to. It is temporary and gets deleted later.
        var ctx = assign({}, context)
        ctx.request = assign({}, request)
        ctx.request.includeType = includeType

        return Promise.all(map(include[includeType], function (record) {
          return Promise.resolve(
            typeof hooks[includeType][1] === 'function' ?
              hooks[includeType][1](ctx, record) : record)
        }))
      }))

        .then(function (types) {
          var i, j, k, l

          // Assign results of output hooks on includes.
          for (i = 0, j = types.length; i < j; i++)
            for (k = 0, l = types[i].length; k < l; k++)
              if (types[i][k]) include[includeTypes[i]][k] = types[i][k]
        })
    }) : Promise.resolve())

    .then(function () {
      // Delete temporary keys, these should not be serialized.
      delete response.records
      delete response.include

      context.response.payload = {
        records: records
      }

      if (include) context.response.payload.include = include

      // Expose the "count" property so that it is serializable.
      if (records && 'count' in records)
        context.response.payload.count = records.count

      return context
    })
}
