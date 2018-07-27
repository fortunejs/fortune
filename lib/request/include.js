'use strict'

var promise = require('../common/promise')
var map = require('../common/array/map')
var find = require('../common/array/find')
var reduce = require('../common/array/reduce')
var message = require('../common/message')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var primaryKey = keys.primary
var linkKey = keys.link


/**
 * Fetch included records. This mutates `context.response`
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
  var language = meta.language
  var response = context.response
  var transaction = context.transaction
  var records = response.records
  var recordTypes = this.recordTypes
  var hasField = true
  var idCache = {}
  var i, j, record, id

  // Skip if there's nothing to be done.
  if (!type || !include || !records) return context

  // This cache is used to keep unique IDs per type.
  idCache[type] = {}
  for (i = 0, j = ids.length; i < j; i++)
    idCache[type][ids[i]] = true

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (!ids.length)
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      id = record[primaryKey]
      if (!idCache[type][id]) idCache[type][id] = true
    }

  // Cast `include` into an array if it's using shorthand.
  if (include.length && !Array.isArray(include[0]))
    include = [ include ]

  return Promise.all(map(include, function (fields) {
    return new Promise(function (resolve, reject) {
      var currentType = type
      var includeOptions = []
      var currentCache, currentIds, currentOptions, currentField
      var i, j, ensureFields

      // Cast `fields` into an array if it's using shorthand.
      if (!Array.isArray(fields) ||
        (!Array.isArray(fields[1]) && typeof fields[1] === 'object'))
        fields = [ fields ]

      for (i = 0, j = fields.length; i < j; i++)
        if (Array.isArray(fields[i])) {
          includeOptions[i] = fields[i][1]
          fields[i] = fields[i][0]
        }

      // Check if first level field in in each record.
      for (i = 0, j = records.length; i < j; i++)
        if (!(fields[0] in records[i])) {
          hasField = false
          break
        }

      // Ensure that the first level field is in each record.
      if (hasField)
        ensureFields = Promise.resolve(records)
      else {
        currentOptions = { fields: {} }
        currentOptions.fields[fields[0]] = true
        currentIds = []
        for (i = 0, j = records.length; i < j; i++)
          currentIds.push(records[i][primaryKey])
        ensureFields = transaction.find(
          type, currentIds, currentOptions, meta)
      }

      return ensureFields
        .then(function (records) {
          return reduce(fields, function (records, field, index) {
            // `cursor` refers to the current collection of records.
            return records.then(function (cursor) {
              currentField = recordTypes[currentType][field]

              if (!currentType || !currentField) return []
              if (!(linkKey in currentField))
                throw new BadRequestError(
                  message('InvalidLink', language, { field: field }))

              currentCache = {}
              currentType = currentField[linkKey]
              currentIds = reduce(cursor, function (ids, record) {
                var linkedIds = Array.isArray(record[field]) ?
                  record[field] : [ record[field] ]
                var i, j, id

                for (i = 0, j = linkedIds.length; i < j; i++) {
                  id = linkedIds[i]
                  if (id && !currentCache[id]) {
                    currentCache[id] = true
                    ids.push(id)
                  }
                }

                return ids
              }, [])

              if (index in includeOptions)
                currentOptions = includeOptions[index]
              else if (index < fields.length - 1) {
                currentOptions = { fields: {} }
                currentOptions.fields[fields[index + 1]] = true
              }
              else currentOptions = null

              return currentIds.length ?
                transaction.find(
                  currentType, currentIds, currentOptions, meta) :
                []
            })
          }, Promise.resolve(records))
        })

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
        var i, j, id, record

        if (!container.ids.length) return include

        if (!include[container.type])
          include[container.type] = []

        // Only include unique IDs per type.
        if (!idCache[container.type])
          idCache[container.type] = {}

        for (i = 0, j = container.ids.length; i < j; i++) {
          id = container.ids[i]

          if (idCache[container.type][id]) continue

          record = find(container.records, matchId(id))

          if (record) {
            idCache[container.type][id] = true
            include[container.type].push(record)
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
