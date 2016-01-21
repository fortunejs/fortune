'use strict'

var deepEqual = require('deep-equal')
var message = require('../../common/message')
var find = require('../../common/array/find')

var errors = require('../../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var isArrayKey = keys.isArray

// For complex types.
var matchCheck = [
  [ Date, function (a, b) { return a.getTime() === b.getTime() } ],
  [ Buffer, function (a, b) { return a.equals(b) } ],
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
  return Date.now() + '_' +
    ('00000000' + Math.floor(Math.random() * Math.pow(2, 32)).toString(16))
    .slice(-8)
}


exports.applyOptions = function (fields, records, options, meta) {
  var i, j, count, record, field, recordFields, isInclude, isExclude, language
  var memoizedRecords, range, match, exists

  if (!options) options = {}
  if (!meta) meta = {}

  language = meta.language
  range = options.range
  match = options.match
  exists = options.exists

  // Apply filters.
  if (range || match || exists) {
    memoizedRecords = records
    records = []
    for (i = 0, j = memoizedRecords.length; i < j; i++) {
      record = memoizedRecords[i]
      if (range && !matchByRange(fields, range, record)) continue
      if (match && !matchByField(fields, match, record)) continue
      if (exists && !matchByExistence(fields, exists, record)) continue
      records.push(record)
    }
  }

  count = records.length

  if ('fields' in options) {
    isInclude = !find(Object.keys(options.fields),
      function (field) { return !options.fields[field] })
    isExclude = !find(Object.keys(options.fields),
      function (field) { return options.fields[field] })

    if (!isInclude && !isExclude)
      throw new BadRequestError(message('FieldsFormat', language))

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
    records = records.slice(options.offset, options.limit ?
      (options.offset || 0) + options.limit : records.length)

  records.count = count

  return records
}


function check (type, a, b) {
  var matcher
  if (b === null) return a === null
  matcher = find(matchCheck, function (pair) {
    return pair[0] === type
  })
  return matcher ? matcher[1](a, b) :
    type && type.equal ? type.equal(a, b) : a === b
}


function checkValue (fieldDefinition, a) {
  return function (b) {
    return fieldDefinition[isArrayKey] ?
      find(a, function (a) {
        return check(fieldDefinition[typeKey], b, a)
      }) : check(fieldDefinition[typeKey], b, a)
  }
}


function matchByField (fields, match, record) {
  var keys = Object.keys(match)
  var i, field, matches

  for (i = keys.length; i--;) {
    field = keys[i]
    matches = match[field]
    if (!Array.isArray(matches)) matches = [ matches ]
    if (find(matches, checkValue(fields[field], record[field])) === void 0)
      return false
  }

  return true
}


function matchByExistence (fields, exists, record) {
  var keys = Object.keys(exists)
  var i, field, value, isArray

  for (i = keys.length; i--;) {
    field = keys[i]
    value = record[field]
    isArray = fields[field][isArrayKey]
    if (exists[field]) {
      if (!value) return false
      if (isArray && !value.length) return false
    }
    else {
      if (value && !isArray) return false
      if (isArray && value.length) return false
    }
  }

  return true
}


function matchByRange (fields, ranges, record) {
  var keys = Object.keys(ranges)
  var compare = {}
  var i, field, fieldDefinition, fieldType, fieldIsArray, range, value

  for (i = keys.length; i--;) {
    field = keys[i]
    fieldDefinition = fields[field]
    fieldType = fieldDefinition[typeKey]
    fieldIsArray = fieldDefinition[isArrayKey]

    // Skip for singular link fields.
    if (!fieldType && !fieldIsArray) continue

    range = ranges[field]
    value = record[field]

    if (value == null) return false
    if (fieldIsArray) value = value ? value.length : 0

    if (!compare[field])
      if (!fieldIsArray) {
        compare[field] = fieldType.compare ||
          find(comparisons, findKey(fieldType))[1]
        if (!compare[field])
          throw new Error('Missing "compare" function.')
      }
      else compare[field] = find(comparisons, findKey(Number))[1]

    if (range[0] !== null && compare[field](value, range[0]) < 0)
      return false

    if (range[1] !== null && compare[field](range[1], value) < 0)
      return false
  }

  return true
}


function findKey (key) {
  return function (pair) {
    return pair[0] === key
  }
}


function compare (fields, sort) {
  var keys = Object.keys(sort)
  var i, j, field, compare, a, b, isAscending,
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
      else if (fieldType) {
        compare = fieldType.compare ||
          find(comparisons, findKey(fieldType))[1]
        if (!compare) throw new Error('Missing "compare" function.')
        result = compare(a, b)
      }

      if (result === 0) continue

      return isAscending ? result : -result
    }

    return 0
  }
}
