'use strict'

var promise = require('../common/promise')
var map = require('../common/array/map')
var find = require('../common/array/find')
var reduce = require('../common/array/reduce')

var keys = require('../common/keys')
var primaryKey = keys.primary
var linkKey = keys.link


/**
 * Fetch included records. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
module.exports = function include (context) {
  var Promise = promise.Promise
  var request = context.request
  var type = request.type
  var ids = request.ids || []
  var include = request.include
  var meta = request.meta
  var response = context.response
  var records = response.records
  var recordTypes = this.recordTypes
  var adapter = this.adapter
  var i, record, id

  // This cache is used to keep unique IDs per type.
  var idCache = Object.create(null)
  idCache[type] = Object.create(null)
  for (i = ids.length; i--;)
    idCache[type][ids[i]] = true

  if (!type || !include || !records) return context

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (ids && !ids.length)
    for (i = records.length; i--;) {
      record = records[i]
      id = record[primaryKey]
      if (!idCache[type][id])
        idCache[type][id] = true
    }

  return Promise.all(map(include, function (fields) {
    return new Promise(function (resolve, reject) {
      var currentType = type
      var currentIds = []
      var currentOptions
      var currentCache

      // Coerce field into an array.
      if (!Array.isArray(fields)) fields = [ fields ]

      // `cursor` refers to the current collection of records.
      return reduce(fields, function (records, field) {
        return records.then(function (cursor) {
          if (!currentType || !recordTypes[currentType][field]) return []

          currentCache = Object.create(null)
          currentType = recordTypes[currentType][field][linkKey]
          currentOptions = context.request.includeOptions ?
            context.request.includeOptions[currentType] : null
          currentIds = reduce(cursor, function (ids, record) {
            var linkedIds = Array.isArray(record[field]) ?
              record[field] : [ record[field] ]
            var i, id

            for (i = linkedIds.length; i--;) {
              id = linkedIds[i]
              if (id && !currentCache[id]) {
                currentCache[id] = true
                ids[ids.length] = id
              }
            }

            return ids
          }, [])

          return currentIds.length ?
            adapter.find(currentType, currentIds, currentOptions, meta) :
            []
        })
      }, Promise.resolve(records))

      .then(function (records) {
        return resolve({
          type: currentType,
          ids: currentIds,
          records: records
        })
      }, function (error) {
        return reject(error)
      })
    })
  }))

  .then(function (containers) {
    var include = reduce(containers, function (include, container) {
      var i, id, record

      if (!container.ids.length) return include

      if (!include[container.type])
        include[container.type] = []

      // Only include unique IDs per type.
      if (!idCache[container.type])
        idCache[container.type] = Object.create(null)

      for (i = container.ids.length; i--;) {
        id = container.ids[i]

        if (idCache[container.type][id]) continue

        record = find(container.records, matchId(id))

        if (record) {
          idCache[container.type][id] = true
          include[container.type][include[container.type].length] = record
        }
      }

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type]

      return include
    }, {})

    if (Object.keys(include).length)
      Object.defineProperty(context.response, 'include', {
        configurable: true,
        value: include
      })

    return context
  })
}


function matchId (id) {
  return function (record) {
    return record[primaryKey] === id
  }
}
