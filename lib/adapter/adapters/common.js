'use strict'

var deepEqual = require('../../common/deep_equal')
var message = require('../../common/message')
var find = require('../../common/array/find')
var generateId = require('../../common/generate_id')

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
  [ Object, function (a, b) { return deepEqual(a, b) } ]
]

// For comparing sort order.
var comparisons = [
  [ Number, function (a, b) { return a - b } ],
  [ String, function (a, b) { return a === b ? 0 : a > b ? 1 : -1 } ],
  [ Boolean, function (a, b) { return a === b ? 0 : a ? 1 : -1 } ],
  [ Date, function (a, b) { return a.getTime() - b.getTime() } ],
  [ Buffer, Buffer.compare ],

  // There is no comparison here that makes sense, so this should simply be a
  // no-op by default.
  [ Object, function () { return 0 } ]
]


// Browser-safe ID generation.
exports.generateId = generateId


exports.applyOptions = function (fields, records, options, meta) {
  var count, record, field, isInclude, isExclude, language, memoizedRecords
  var i, j

  if (!options) options = {}
  if (!meta) meta = {}

  language = meta.language

  // Apply filters.
  if (options) {
    memoizedRecords = records
    records = []
    for (i = 0, j = memoizedRecords.length; i < j; i++) {
      record = memoizedRecords[i]
      if (match(fields, options, record))
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

    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      for (field in record) {
        if (field === primaryKey) continue
        if ((isInclude && !(options.fields.hasOwnProperty(field))) ||
          (isExclude && options.fields.hasOwnProperty(field)))
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
  if (!type) return a === b
  if (type.compare) return type.compare(a, b) === 0

  matcher = find(matchCheck, function (pair) {
    return pair[0] === type.prototype.constructor
  })
  if (matcher) return matcher[1](a, b)

  return a === b
}


function checkValue (fieldDefinition, a) {
  return function (b) {
    return fieldDefinition[isArrayKey] ?
      find(a, function (a) {
        return check(fieldDefinition[typeKey], b, a)
      }) : check(fieldDefinition[typeKey], b, a)
  }
}

function match (fields, options, record) {
  var key

  for (key in options)
    switch (key) {
    case 'and':
      if (!matchByLogicalAnd(fields, options[key], record)) return false
      break
    case 'or':
      if (!matchByLogicalOr(fields, options[key], record)) return false
      break
    case 'not':
      if (match(fields, options[key], record)) return false
      break
    case 'range':
      if (!matchByRange(fields, options[key], record)) return false
      break
    case 'match':
      if (!matchByField(fields, options[key], record)) return false
      break
    case 'exists':
      if (!matchByExistence(fields, options[key], record)) return false
      break
    default:
    }

  return true
}

function matchByLogicalAnd (fields, clauses, record) {
  var i

  for (i = 0; i < clauses.length; i++)
    if (!match(fields, clauses[i], record)) return false

  return true
}

function matchByLogicalOr (fields, clauses, record) {
  var i

  for (i = 0; i < clauses.length; i++)
    if (match(fields, clauses[i], record)) return true

  return false
}

function matchByField (fields, match, record) {
  var field, matches

  for (field in match) {
    matches = match[field]
    if (!Array.isArray(matches)) matches = [ matches ]
    if (find(matches, checkValue(fields[field], record[field])) === void 0)
      return false
  }

  return true
}


function matchByExistence (fields, exists, record) {
  var field, value, isArray

  for (field in exists) {
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
  var compare = {}
  var field, fieldDefinition, fieldType, fieldIsArray, range, value

  for (field in ranges) {
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
      compare[field] = !fieldIsArray ? fieldType.compare ||
        find(comparisons, findByType(fieldType))[1] :
        find(comparisons, findByType(Number))[1]

    if (range[0] !== null && compare[field](value, range[0]) < 0)
      return false

    if (range[1] !== null && compare[field](range[1], value) < 0)
      return false
  }

  return true
}


function findByType (type) {
  return function (pair) {
    return pair[0] === type.prototype.constructor
  }
}


function compare (fields, sort) {
  var field, compare, a, b, isAscending,
    fieldDefinition, fieldIsArray, fieldType, result

  return function (x, y) {
    for (field in sort) {
      a = x[field]
      b = y[field]
      isAscending = sort[field]
      fieldDefinition = fields[field]
      fieldIsArray = fieldDefinition[isArrayKey]
      fieldType = fieldDefinition[typeKey]

      if (a === null) return 1
      if (b === null) return -1

      result = 0

      if (fieldIsArray) result = a.length - b.length
      else if (fieldType) {
        compare = fieldType.compare ||
          find(comparisons, findByType(fieldType))[1]
        if (!compare) throw new Error('Missing "compare" function.')
        result = compare(a, b)
      }

      if (result === 0) continue

      return isAscending ? result : -result
    }

    return 0
  }
}
