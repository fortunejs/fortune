'use strict'

var deepEqual = require('deep-equal')
var filter = require('../../common/array/filter')
var find = require('../../common/array/find')

var arrayBuffer = require('array-buffer')
var toBuffer = arrayBuffer.toBuffer

var errors = require('../../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var isArrayKey = keys.isArray

// For complex types.
var matchCheck = [
  [ Date, function (a, b) { return a.getTime() === b.getTime() } ],
  [ Buffer, function (a, b) { return a.equals(toBuffer(b)) } ],
  [ Object, function (a, b) { return deepEqual(a, b, { strict: true }) } ]
]

// For comparing sort order.
var comparisons = [
  [ Number, function (a, b) { return a - b } ],
  [ String, function (a, b) { return a < b ? -1 : a > b ? 1 : 0 } ],
  [ Boolean, function (a, b) { return a === b ? 0 : a ? 1 : -1 } ],
  [ Date, function (a, b) { return a.getTime() - b.getTime() } ],
  [ Buffer, Buffer.compare ],

  // There is no comparison here that makes sense.
  [ Object, function (a, b) {
    return Object.keys(a).length - Object.keys(b).length
  } ]
]


// Browser-safe ID generation.
exports.generateId = function () {
  return ('00000000' + Math.floor(Math.random() * Math.pow(2, 32))
    .toString(16)).slice(-8)
}


exports.applyOptions = function (count, fields, records, options) {
  var i, j, record, field, recordFields, isInclude, isExclude

  if (!options) options = {}

  if ('match' in options) {
    records = filter(records, matchByField(fields, options.match))
    count = records.length
  }

  if ('fields' in options) {
    isInclude = !find(Object.keys(options.fields),
      function (field) { return !options.fields[field] })
    isExclude = !find(Object.keys(options.fields),
      function (field) { return options.fields[field] })

    if (!isInclude && !isExclude)
      throw new BadRequestError('Fields format is invalid.')

    for (i = records.length; i--;) {
      record = records[i]
      recordFields = Object.keys(record)
      for (j = recordFields.length; j--;) {
        field = recordFields[j]
        if (field === primaryKey) continue
        if ((isInclude && !(field in options.fields)) ||
          (isExclude && field in options.fields))
          delete record[field]
      }
    }
  }

  if ('sort' in options)
    records = records.sort(compare(fields, options.sort))

  if ('limit' in options || 'offset' in options)
    records = records.slice(options.offset,
      options.offset && options.limit ?
      options.offset + options.limit : options.limit)

  records.count = count

  return records
}


function check (type, a, b) {
  var matcher
  if (b === null) return a === null
  matcher = find(matchCheck, function (pair) {
    return pair[0] === type
  })
  return matcher ? matcher[1](a, b) : a === b
}


function checkValue (fieldDefinition, a) {
  return function (b) {
    return fieldDefinition[isArrayKey] ?
      find(a, function (a) {
        return check(fieldDefinition[typeKey], b, a)
      }) : check(fieldDefinition[typeKey], b, a)
  }
}


function matchByField (fields, match) {
  var keys = Object.keys(match)
  var i, field, matches

  return function (record) {
    for (i = keys.length; i--;) {
      field = keys[i]
      matches = match[field]
      if (!Array.isArray(match[field])) matches = [ matches ]
      if (undefined === find(matches, checkValue(fields[field], record[field])))
        return false
    }

    return true
  }
}


function findKey (key) {
  return function (pair) {
    return pair[0] === key
  }
}


function compare (fields, sort) {
  var keys = Object.keys(sort)
  var i, j, field, a, b, isAscending,
    fieldDefinition, fieldIsArray, fieldType, result

  return function (x, y) {
    for (i = 0, j = keys.length; i < j; i++) {
      field = keys[i]
      a = x[field]
      b = y[field]
      isAscending = sort[field]
      fieldDefinition = fields[field]
      fieldIsArray = fieldDefinition[isArrayKey]
      fieldType = fieldDefinition[typeKey]

      if (a === null) return isAscending ? -1 : 1
      if (b === null) return isAscending ? 1 : -1

      result = 0

      if (fieldIsArray) result = a.length - b.length
      else if (fieldType)
        result = find(comparisons, findKey(fieldType))[1](a, b)

      if (result === 0) continue

      return isAscending ? result : -result
    }

    return 0
  }
}
