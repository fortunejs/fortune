/*!
 * Fortune.js
 * Version 5.5.18
 * MIT License
 * http://fortune.js.org
 */
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (Buffer){(function (){
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


exports.applyOptions = function (fields, records, options, meta, adapterInstance, type) {
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
      if (match(fields, options, record, adapterInstance, type))
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

  matcher = find(matchCheck, findByType(type))

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

function match (fields, options, record, adapterInstance, type) {
  var key

  for (key in options)
    switch (key) {
    case 'and':
      if (!matchByLogicalAnd(fields, options[key], record, adapterInstance, type)) return false
      break
    case 'or':
      if (!matchByLogicalOr(fields, options[key], record, adapterInstance, type)) return false
      break
    case 'not':
      if (match(fields, options[key], record, adapterInstance, type)) return false
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
    case 'fuzzyMatch':
      if (!matchByFuzzyMatch (options[key], record, adapterInstance, type) ) return false
    default:
    }

  return true
}

function matchByLogicalAnd (fields, clauses, record, adapterInstance, type) {
  var i

  for (i = 0; i < clauses.length; i++)
    if (!match(fields, clauses[i], record, adapterInstance, type)) return false

  return true
}

function matchByLogicalOr (fields, clauses, record, adapterInstance, type) {
  var i

  for (i = 0; i < clauses.length; i++)
    if (match(fields, clauses[i], record, adapterInstance, type)) return true

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


/**
 * Fuzzy matching of attribute values.
 * Works both on attributes of the record,
 *  or attributes of (nested) relations of the record.
 */
function matchByFuzzyMatch (filters, record, adapterInstance, type) {
  for(const filterProperty of Object.keys(filters)){
    const valueToFilter = filters[filterProperty]
    if(isRelationFilter(filterProperty)){
      const isMatching = doesFuzzyMatchRelation(record,
                                                filterProperty,
                                                valueToFilter,
                                                adapterInstance,
                                                type)
      if(!isMatching) return false;
    }
    else if(!doesFuzzyMatchSimple(record, filterProperty, valueToFilter))
      return false
  }
  return true
}

function doesFuzzyMatchSimple(record, filterProp, valueToFilter){
  const recordValue = record[filterProp]
  return String(recordValue).toLowerCase().includes(String(valueToFilter).toLowerCase())
}

function doesFuzzyMatchRelation( record, filterProp, valueToFilter, adapterInstance, type){
  const relationFilterSegments = getRelationFilterSegments(filterProp)
  const recordTypes = adapterInstance.recordTypes
  const currentFields = recordTypes[type]
  const typesPath = constructTypesPathToChild(recordTypes,
                                              currentFields,
                                              relationFilterSegments,
                                              [] )
  const attributeToFilter = relationFilterSegments.splice(-1)
  const recordsForFiltering = walkRelationPath(currentFields,
                                               [ record ],
                                               relationFilterSegments,
                                               typesPath,
                                               adapterInstance)
  return recordsForFiltering
    .filter(record => doesFuzzyMatchSimple(record, attributeToFilter, valueToFilter) )
    .length
}

function walkRelationPath(currentFields, currRecords,
                          relationPath, typesPath, adapterInstance){

  if(!relationPath.length){
    return currRecords
  }
  const nextRecords = []
  const relation = relationPath[0]
  const targetType = typesPath[0]
  const isArray = currentFields[relation].isArray

  for(const currRecord of currRecords){
    const ids = isArray ? currRecord[relation] : [ currRecord[relation] ]

    for(const id of ids){
      const record = adapterInstance.db[targetType][id]
      if(record) nextRecords.push( record )
    }
  }

  return walkRelationPath(adapterInstance.recordTypes[targetType],
                          nextRecords, relationPath.slice(1),
                          typesPath.slice(1), adapterInstance)
}

function isRelationFilter ( field ) {
  return field.split(':').length > 1
}

function getRelationFilterSegments ( field ) {
  return field.split(':')
}

function constructTypesPathToChild ( recordTypes, parent,
                                     remainingPathSegments, typesPath ) {
  if ( !remainingPathSegments.length )
    return typesPath


  const segment = remainingPathSegments[0]
  const nextType = parent[segment].link

  //complex type
  if ( nextType ) {
    typesPath.push( nextType )
    parent = recordTypes[nextType]
  }
  return constructTypesPathToChild(recordTypes, parent,
                                   remainingPathSegments.slice(1), typesPath )
}


function findByType (type) {
  return function (pair) {
    var hasMatch = type === pair[0] ||
      type.name === pair[0].name

    // In case this errors due to security sandboxing, just skip this check.
    if (!hasMatch)
      try {
        hasMatch = pair[0] === type.prototype.constructor
      }
      catch (e) {
        // Swallow this error.
      }

    return hasMatch
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

}).call(this)}).call(this,require("buffer").Buffer)
},{"../../common/array/find":8,"../../common/deep_equal":19,"../../common/errors":20,"../../common/generate_id":22,"../../common/keys":24,"../../common/message":25,"buffer":47}],2:[function(require,module,exports){
'use strict'

var common = require('../common')
var generateId = common.generateId


exports.inputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, j, field

  // Ensure that ID exists on the record.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (i = 0, j = fieldsArray.length; i < j; i++) {
    field = fieldsArray[i]
    if (!record.hasOwnProperty(field)) {
      result[field] = fields[field][isArrayKey] ? [] : null
      continue
    }

    result[field] = record[field]
  }

  return result
}


exports.outputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var denormalizedInverseKey = this.keys.denormalizedInverse
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, j, field, hasField, value

  // Ensure that ID exists on the record.
  result[primaryKey] = record[primaryKey]

  for (i = 0, j = fieldsArray.length; i < j; i++) {
    field = fieldsArray[i]
    hasField = record.hasOwnProperty(field)
    value = hasField ? record[field] :
      fields[field][isArrayKey] ? [] : null

    // Do not enumerate denormalized fields.
    if (fields[field][denormalizedInverseKey]) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value: value
      })
      continue
    }

    if (hasField) result[field] = value
  }

  return result
}

},{"../common":1}],3:[function(require,module,exports){
'use strict'

var applyUpdate = require('../../../common/apply_update')
var map = require('../../../common/array/map')
var promise = require('../../../common/promise')

var common = require('../common')
var applyOptions = common.applyOptions

var helpers = require('./helpers')
var inputRecord = helpers.inputRecord
var outputRecord = helpers.outputRecord


/**
 * Memory adapter.
 */
module.exports = function (Adapter) {
  function MemoryAdapter (properties) {
    Adapter.call(this, properties)
    if (!this.options) this.options = {}
    if (!('recordsPerType' in this.options))
      this.options.recordsPerType = 1000
  }

  MemoryAdapter.prototype = new Adapter()

  MemoryAdapter.prototype.connect = function () {
    var Promise = promise.Promise
    var recordTypes = this.recordTypes
    var type

    this.db = {}

    for (type in recordTypes)
      this.db[type] = {}

    return Promise.resolve()
  }


  MemoryAdapter.prototype.disconnect = function () {
    var Promise = promise.Promise

    delete this.db
    return Promise.resolve()
  }


  MemoryAdapter.prototype.find = function (type, ids, options, meta) {
    var Promise = promise.Promise
    var self = this
    var recordTypes = self.recordTypes
    var fields = recordTypes[type]
    var collection = self.db[type]

    var records = []
    var i, j, id, record

    if (ids && !ids.length) return Adapter.prototype.find.call(self)

    if (ids) for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      if (collection.hasOwnProperty(id)) {
        record = collection[id]

        // LRU update.
        delete collection[id]
        collection[id] = record

        records.push(outputRecord.call(self, type, record))
      }
    }

    else for (id in collection)
      records.push(outputRecord.call(self, type, collection[id]))

    return Promise
      .resolve(applyOptions(fields, records, options, meta, self, type))
  }


  MemoryAdapter.prototype.create = function (type, records, meta) {
    var Promise = promise.Promise
    var self = this
    var message = self.message
    var recordsPerType = self.options.recordsPerType
    var primaryKey = self.keys.primary
    var ConflictError = self.errors.ConflictError
    var collection = self.db[type]
    var i, j, record, id, ids, language

    if (!meta) meta = {}
    language = meta.language

    records = map(records, function (record) {
      return inputRecord.call(self, type, record)
    })

    // First check for collisions.
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      id = record[primaryKey]

      if (collection.hasOwnProperty(id))
        return Promise.reject(new ConflictError(
          message('RecordExists', language, { id: id })))
    }

    // Then save it to memory.
    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      collection[record[primaryKey]] = record
    }

    // Clear least recently used records.
    if (recordsPerType) {
      ids = Object.keys(collection)

      if (ids.length > recordsPerType) {
        ids = ids.slice(0, ids.length - recordsPerType)

        for (i = 0, j = ids.length; i < j; i++)
          delete collection[ids[i]]
      }
    }

    return Promise.resolve(map(records, function (record) {
      return outputRecord.call(self, type, record)
    }))
  }


  MemoryAdapter.prototype.update = function (type, updates) {
    var Promise = promise.Promise
    var self = this
    var primaryKey = self.keys.primary
    var collection = self.db[type]
    var count = 0
    var i, j, update, id, record

    if (!updates.length) return Adapter.prototype.update.call(self)

    for (i = 0, j = updates.length; i < j; i++) {
      update = updates[i]
      id = update[primaryKey]
      record = collection[id]

      if (!record) continue

      count++
      record = outputRecord.call(self, type, record)

      applyUpdate(record, update)

      // LRU update.
      delete collection[id]

      collection[id] = inputRecord.call(self, type, record)
    }

    return Promise.resolve(count)
  }


  MemoryAdapter.prototype.delete = function (type, ids) {
    var Promise = promise.Promise
    var collection = this.db[type]
    var count = 0
    var i, j, id

    if (ids && !ids.length) return Adapter.prototype.delete.call(this)

    if (ids) for (i = 0, j = ids.length; i < j; i++) {
      id = ids[i]
      if (collection[id]) {
        delete collection[id]
        count++
      }
    }

    else for (id in collection) {
      delete collection[id]
      count++
    }

    return Promise.resolve(count)
  }

  // Expose utility functions.
  MemoryAdapter.common = common

  // Expose features for introspection.
  MemoryAdapter.features = {
    logicalOperators: true
  }

  return MemoryAdapter
}

},{"../../../common/apply_update":6,"../../../common/array/map":10,"../../../common/promise":28,"../common":1,"./helpers":2}],4:[function(require,module,exports){
'use strict'

var assign = require('../common/assign')
var promise = require('../common/promise')
var memoryAdapter = require('./adapters/memory')


/**
 * Adapter is an abstract base class containing methods to be implemented. All
 * records returned by the adapter must have the primary key `id`. The primary
 * key **MUST** be a string or a number.
 *
 * It has one static property, `DefaultAdapter` which is a reference to the
 * memory adapter.
 */
function Adapter (properties) {
  assign(this, properties)
}


/**
 * The Adapter should not be instantiated directly, since the constructor
 * function accepts dependencies. The keys which are injected are:
 *
 * - `recordTypes`: an object which enumerates record types and their
 * definitions.
 * - `options`: the options passed to the adapter.
 * - `common`: an object containing all internal utilities.
 * - `errors`: same as static property on Fortune class.
 * - `keys`: an object which enumerates reserved constants for record type
 * - `message`: a function with the signature (`id`, `language`, `data`).
 *
 * These keys are accessible on the instance (`this`).
 *
 * An adapter may expose a `features` static property, which is an object
 * that can contain boolean flags. These are used mainly for checking which
 * additional features may be tested.
 *
 * - `logicalOperators`: whether or not `and` and `or` queries are supported.
 */
Adapter.prototype.constructor = function () {
  // This exists here only for documentation purposes.
}

delete Adapter.prototype.constructor


/**
 * The responsibility of this method is to ensure that the record types
 * defined are consistent with the backing data store. If there is any
 * mismatch it should either try to reconcile differences or fail.
 * This method **SHOULD NOT** be called manually, and it should not accept
 * any parameters. This is the time to do setup tasks like create tables,
 * ensure indexes, etc. On successful completion, it should resolve to no
 * value.
 *
 * @return {Promise}
 */
Adapter.prototype.connect = function () {
  var Promise = promise.Promise
  return Promise.resolve()
}


/**
 * Close the database connection.
 *
 * @return {Promise}
 */
Adapter.prototype.disconnect = function () {
  var Promise = promise.Promise
  return Promise.resolve()
}


/**
 * Create records. A successful response resolves to the newly created
 * records.
 *
 * **IMPORTANT**: the record must have initial values for each field defined
 * in the record type. For non-array fields, it should be `null`, and for
 * array fields it should be `[]` (empty array). Note that not all fields in
 * the record type may be enumerable, such as denormalized inverse fields, so
 * it may be necessary to iterate over fields using
 * `Object.getOwnPropertyNames`.
 *
 * @param {String} type
 * @param {Object[]} records
 * @param {Object} [meta]
 * @return {Promise}
 */
Adapter.prototype.create = function () {
  var Promise = promise.Promise
  return Promise.resolve([])
}


/**
 * Find records by IDs and options. If IDs is undefined, it should try to
 * return all records. However, if IDs is an empty array, it should be a
 * no-op. The format of the options may be as follows:
 *
 * ```js
 * {
 *   sort: { ... },
 *   fields: { ... },
 *   exists: { ... },
 *   match: { ... },
 *   range: { ... },
 *
 *   // Limit results to this number. Zero means no limit.
 *   limit: 0,
 *
 *   // Offset results by this much from the beginning.
 *   offset: 0,
 *
 *   // The logical operator "and", may be nested. Optional feature.
 *   and: { ... },
 *
 *   // The logical operator "or", may be nested. Optional feature.
 *   or: { ... },
 *
 *   // Reserved field for custom querying.
 *   query: null
 * }
 * ```
 *
 * For the fields `exists`, `match`, and `range`, the logical operator should
 * be "and". The `query` field may be used on a per adapter basis to provide
 * custom querying functionality.
 *
 * The syntax of the `sort` object is as follows:
 *
 * ```js
 * {
 *   age: false, // descending
 *   name: true // ascending
 * }
 * ```
 *
 * Fields can be specified to be either included or omitted, but not both.
 * Use the values `true` to include, or `false` to omit. The syntax of the
 * `fields` object is as follows:
 *
 * ```js
 * {
 *   name: true, // include this field
 *   age: true // also include this field
 * }
 * ```
 *
 * The `exists` object specifies if a field should exist or not (`true` or
 * `false`). For array fields, it should check for non-zero length.
 *
 * ```js
 * {
 *   name: true, // check if this fields exists
 *   age: false // check if this field doesn't exist
 * }
 * ```
 *
 * The syntax of the `match` object is straightforward:
 *
 * ```js
 * {
 *   name: 'value', // exact match or containment if array
 *   friends: [ 'joe', 'bob' ] // match any one of these values
 * }
 * ```
 *
 * The `range` object is used to filter between lower and upper bounds. It
 * should take precedence over `match`. For array fields, it should apply on
 * the length of the array. For singular link fields, it should not apply.
 *
 * ```js
 * {
 *   range: { // Ranges should be inclusive.
 *     age: [ 18, null ], // From 18 and above.
 *     name: [ 'a', 'd' ], // Starting with letters A through C.
 *     createdAt: [ null, new Date(2016, 0) ] // Dates until 2016.
 *   }
 * }
 * ```
 *
 * The return value of the promise should be an array, and the array **MUST**
 * have a `count` property that is the total number of records without limit
 * and offset.
 *
 * @param {String} type
 * @param {String[]|Number[]} [ids]
 * @param {Object} [options]
 * @param {Object} [meta]
 * @return {Promise}
 */
Adapter.prototype.find = function () {
  var Promise = promise.Promise
  var results = []
  results.count = 0
  return Promise.resolve(results)
}


/**
 * Update records by IDs. Success should resolve to the number of records
 * updated. The `updates` parameter should be an array of objects that
 * correspond to updates by IDs. Each update object must be as follows:
 *
 * ```js
 * {
 *   // ID to update. Required.
 *   id: 1,
 *
 *   // Replace a value of a field. Use a `null` value to unset a field.
 *   replace: { name: 'Bob' },
 *
 *   // Append values to an array field. If the value is an array, all of
 *   // the values should be pushed.
 *   push: { pets: 1 },
 *
 *   // Remove values from an array field. If the value is an array, all of
 *   // the values should be removed.
 *   pull: { friends: [ 2, 3 ] },
 *
 *   // The `operate` field is specific to the adapter. This should take
 *   // precedence over all of the above. Warning: using this may bypass
 *   // field definitions and referential integrity. Use at your own risk.
 *   operate: null
 * }
 * ```
 *
 * Things to consider:
 *
 * - `push` and `pull` can not be applied to non-arrays.
 * - The same value in the same field should not exist in both `push` and
 * `pull`.
 *
 * @param {String} type
 * @param {Object[]} updates
 * @param {Object} [meta]
 * @return {Promise}
 */
Adapter.prototype.update = function () {
  var Promise = promise.Promise
  return Promise.resolve(0)
}


/**
 * Delete records by IDs, or delete the entire collection if IDs are
 * undefined or empty. Success should resolve to the number of records
 * deleted.
 *
 * @param {String} type
 * @param {String[]|Number[]} [ids]
 * @param {Object} [meta]
 * @return {Promise}
 */
Adapter.prototype.delete = function () {
  var Promise = promise.Promise
  return Promise.resolve(0)
}


/**
 * Begin a transaction to write to the data store. This method is optional
 * to implement, but useful for ACID. It should resolve to an object
 * containing all of the adapter methods.
 *
 * @return {Promise}
 */
Adapter.prototype.beginTransaction = function () {
  var Promise = promise.Promise
  return Promise.resolve(this)
}


/**
 * End a transaction. This method is optional to implement.
 * It should return a Promise with no value if the transaction is
 * completed successfully, or reject the promise if it failed.
 *
 * @param {Error} [error] - If an error is passed, roll back the transaction.
 * @return {Promise}
 */
Adapter.prototype.endTransaction = function () {
  var Promise = promise.Promise
  return Promise.resolve()
}


/**
 * Apply operators on a record, then return the record. If you make use of
 * update operators, you should implement this method so that the internal
 * implementation of update requests get records in the correct state. This
 * method is optional to implement.
 *
 * @param {Object} record
 * @param {Object} operators - The `operate` field on an `update` object.
 * @return {Object}
 */
Adapter.prototype.applyOperators = function (record) {
  return record
}


// Expose the default adapter.
Adapter.DefaultAdapter = memoryAdapter(Adapter)

// Expose features object.
Adapter.features = {}

module.exports = Adapter

},{"../common/assign":14,"../common/promise":28,"./adapters/memory":3}],5:[function(require,module,exports){
'use strict'

var Adapter = require('./')
var common = require('../common')
var errors = require('../common/errors')
var keys = require('../common/keys')
var promise = require('../common/promise')


/**
 * A singleton for the adapter. For internal use.
 */
function AdapterSingleton (properties) {
  var CustomAdapter, input

  input = Array.isArray(properties.adapter) ?
    properties.adapter : [ properties.adapter ]

  if (typeof input[0] !== 'function')
    throw new TypeError('The adapter must be a function.')

  CustomAdapter = Adapter.prototype
    .isPrototypeOf(input[0].prototype) ? input[0] : input[0](Adapter)

  if (!Adapter.prototype.isPrototypeOf(CustomAdapter.prototype))
    throw new TypeError('The adapter must inherit the Adapter class.')

  return new CustomAdapter({
    options: input[1] || {},
    recordTypes: properties.recordTypes,
    features: CustomAdapter.features,
    common: common,
    errors: errors,
    keys: keys,
    message: properties.message,
    Promise: promise.Promise
  })
}


module.exports = AdapterSingleton

},{"../common":23,"../common/errors":20,"../common/keys":24,"../common/promise":28,"./":4}],6:[function(require,module,exports){
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

},{"./array/pull":11}],7:[function(require,module,exports){
'use strict'

/**
 * A more performant `Array.prototype.filter`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {Boolean}
 */
module.exports = function filter (array, fn) {
  var i, j, k = [], l = 0

  for (i = 0, j = array.length; i < j; i++)
    if (fn(array[i], i, array))
      k[l++] = array[i]

  return k
}

},{}],8:[function(require,module,exports){
'use strict'

/**
 * A more performant `Array.prototype.find`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {*}
 */
module.exports = function find (array, fn) {
  var i, j, value, result

  for (i = 0, j = array.length; i < j; i++) {
    value = array[i]
    result = fn(value)
    if (result) return value
  }

  return void 0
}

},{}],9:[function(require,module,exports){
'use strict'

/**
 * A more performant `Array.prototype.includes`.
 *
 * @param {*[]} array
 * @param {*} value
 * @return {Boolean}
 */
module.exports = function includes (array, value) {
  var i, j

  for (i = 0, j = array.length; i < j; i++)
    if (array[i] === value) return true

  return false
}

},{}],10:[function(require,module,exports){
'use strict'

/**
 * A more performant `Array.prototype.map`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @return {Boolean}
 */
module.exports = function map (array, fn) {
  var i, j, k = [], l = 0

  for (i = 0, j = array.length; i < j; i++)
    k[l++] = fn(array[i], i, array)

  return k
}

},{}],11:[function(require,module,exports){
'use strict'


/**
 * Pull primitive values from an array.
 *
 * @param {*[]} array
 * @param {*|*[]} values
 * @return {*[]}
 */
module.exports = function pull (array, values) {
  var hash = {}, clone = [], value
  var i, j

  if (Array.isArray(values))
    for (i = 0, j = values.length; i < j; i++)
      hash[values[i]] = true
  else hash[values] = true

  // Need to iterate backwards.
  for (i = array.length; i--;) {
    value = array[i]
    if (!hash.hasOwnProperty(value))
      // Unshift because it is iterating backwards.
      clone.unshift(value)
  }

  return clone
}

},{}],12:[function(require,module,exports){
'use strict'

/**
 * A more performant `Array.prototype.reduce`.
 *
 * @param {*[]} array
 * @param {Function} fn
 * @param {*} [initialValue]
 * @return {Boolean}
 */
module.exports = function reduce (array, fn, initialValue) {
  var i, j, k = initialValue

  for (i = 0, j = array.length; i < j; i++)
    k = fn(k, array[i], i, array)

  return k
}

},{}],13:[function(require,module,exports){
'use strict'

/**
 * Return an array with unique values. Values must be primitive, and the array
 * may not be sparse.
 *
 * @param {Array}
 * @return {Array}
 */
module.exports = function unique (a) {
  var seen = {}
  var result = []
  var i, j, k

  for (i = 0, j = a.length; i < j; i++) {
    k = a[i]
    if (seen.hasOwnProperty(k)) continue
    result.push(k)
    seen[k] = true
  }

  return result
}

},{}],14:[function(require,module,exports){
'use strict'

/**
 * Like `Object.assign`, but faster and more restricted in what it does.
 *
 * @param {Object} target
 * @return {Object}
 */
module.exports = function assign (target) {
  var i, j, key, source

  for (i = 1, j = arguments.length; i < j; i++) {
    source = arguments[i]

    if (source == null) continue

    for (key in source)
      target[key] = source[key]
  }

  return target
}

},{}],15:[function(require,module,exports){
'use strict'

module.exports = function castToNumber (id) {
  // Stolen from jQuery source code:
  // https://api.jquery.com/jQuery.isNumeric/
  var float = Number.parseFloat(id)
  return id - float + 1 >= 0 ? float : id
}

},{}],16:[function(require,module,exports){
(function (Buffer){(function (){
'use strict'

var errors = require('./errors')
var message = require('./message')
var castToNumber = require('./cast_to_number')
var BadRequestError = errors.BadRequestError
var buffer = Buffer.from || function (input, encoding) {
  return new Buffer(input, encoding)
}


var castByType = [
  [ Number, function (x) { return parseFloat(x) } ],

  [ Date, function (x, options) {
    if (typeof x === 'string') {
      x = Date.parse(x)
      if (Number.isNaN(x)) throw new BadRequestError(
        message('DateISO8601', options.language))
    }

    x = new Date(x)
    if (Number.isNaN(x.getTime())) throw new BadRequestError(
      message('DateInvalid', options.language))

    return x
  } ],

  [ Buffer, function (x, options) {
    var bufferEncoding = options && options.bufferEncoding ?
      options.bufferEncoding : 'base64'

    if (typeof x !== 'string') throw new BadRequestError(
      message('BufferEncoding', options.language, {
        bufferEncoding: bufferEncoding
      }))

    return buffer(x, bufferEncoding)
  } ],

  [ Boolean, function (x) {
    if (typeof x === 'string')
      return (/^(?:true|1|yes|t|y)$/i).test(x)
    return Boolean(x)
  } ],

  [ Object, function (x, options) {
    if (typeof x === 'string') return JSON.parse(x)
    if (typeof x === 'object') return x
    throw new BadRequestError(message('JSONParse', options.language))
  } ],

  [ String, function (x) { return '' + x } ]
]


/**
 * Cast a value to the given type. Skip if type is missing or value is null.
 *
 * @param {*} value
 * @param {Function} type - Constructor function.
 * @param {Object} [options]
 * @return {*}
 */
module.exports = function castValue (value, type, options) {
  var i, j, pair, hasMatch, cast

  // Special case for empty string: it should be null.
  if (value === '') return null

  if (type)
    for (i = 0, j = castByType.length; i < j; i++) {
      pair = castByType[i]
      hasMatch = pair[0] === type || pair[0].name === type.name

      if (!hasMatch)
        try {
          hasMatch = pair[0] === type.prototype.constructor
        }
        catch (e) {
          // Swallow this error.
        }

      if (hasMatch) {
        cast = pair[1]
        break
      }
    }
  else return castToNumber(value)

  return cast && value !== null ? cast(value, options) : value
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"./cast_to_number":15,"./errors":20,"./message":25,"buffer":47}],17:[function(require,module,exports){
'use strict'

/**
 * A fast deep clone function, which covers mostly serializable objects.
 *
 * @param {*}
 * @return {*}
 */
module.exports = function clone (input) {
  var output, key, value, isArray

  if (Array.isArray(input)) isArray = true
  else if (input == null || Object.getPrototypeOf(input) !== Object.prototype)
    return input

  output = isArray ? [] : {}

  for (key in input) {
    value = input[key]
    output[key] = value !== null && value !== undefined &&
      Object.getPrototypeOf(value) === Object.prototype ||
      Array.isArray(value) ? clone(value) : value
  }

  return output
}

},{}],18:[function(require,module,exports){
'use strict'

var hasSymbol = typeof Symbol === 'function'
var i, j, key
var privateKeys = [
  // This is set on the field definition object internally if it is an
  // automatically generated denormalized field.
  'denormalizedInverse',

  // Used to map update objects to records.
  'updateRecord',

  // Used to map update objects to a hash of linked records.
  'linkedHash'
]

// The primary key that must exist per record, can not be user defined.
exports.primary = 'id'

// The names of certain reserved keys per field definition.
exports.type = 'type'
exports.link = 'link'
exports.inverse = 'inverse'
exports.isArray = 'isArray'

// Should be reserved for private use.
for (i = 0, j = privateKeys.length; i < j; i++) {
  key = privateKeys[i]
  exports[key] = hasSymbol ? Symbol(key) : '__' + key + '__'
}

// Events.
exports.change = 'change'
exports.sync = 'sync'
exports.connect = 'connect'
exports.disconnect = 'disconnect'
exports.failure = 'failure'

// Methods.
exports.find = 'find'
exports.create = 'create'
exports.update = 'update'
exports.delete = 'delete'

},{}],19:[function(require,module,exports){
(function (Buffer){(function (){
'use strict'

/**
 * A fast recursive equality check, which covers limited use cases.
 *
 * @param {Object}
 * @param {Object}
 * @return {Boolean}
 */
function deepEqual (a, b) {
  var key, value, compare, aLength = 0, bLength = 0

  // If they are the same object, don't need to go further.
  if (a === b) return true

  // Both objects must be defined.
  if (!a || !b) return false

  // Objects must be of the same type.
  if (a.prototype !== b.prototype) return false

  for (key in a) {
    aLength++
    value = a[key]
    compare = b[key]

    if (typeof value === 'object') {
      if (typeof compare !== 'object' || !deepEqual(value, compare))
        return false
      continue
    }

    if (Buffer.isBuffer(value)) {
      if (!Buffer.isBuffer(compare) || !value.equals(compare))
        return false
      continue
    }

    if (value && typeof value.getTime === 'function') {
      if (!compare || typeof compare.getTime !== 'function' ||
        value.getTime() !== compare.getTime())
        return false
      continue
    }

    if (value !== compare) return false
  }

  for (key in b) bLength++

  // Keys must be of same length.
  return aLength === bLength
}


module.exports = deepEqual

}).call(this)}).call(this,{"isBuffer":require("../../node_modules/is-buffer/index.js")})
},{"../../node_modules/is-buffer/index.js":51}],20:[function(require,module,exports){
'use strict'

var responseClass = require('./response_classes')

exports.BadRequestError = responseClass.BadRequestError
exports.UnauthorizedError = responseClass.UnauthorizedError
exports.ForbiddenError = responseClass.ForbiddenError
exports.NotFoundError = responseClass.NotFoundError
exports.MethodError = responseClass.MethodError
exports.NotAcceptableError = responseClass.NotAcceptableError
exports.ConflictError = responseClass.ConflictError
exports.UnsupportedError = responseClass.UnsupportedError
exports.UnprocessableError = responseClass.UnprocessableError
exports.nativeErrors = responseClass.nativeErrors

},{"./response_classes":29}],21:[function(require,module,exports){
'use strict'

var constants = require('./constants')

exports.change = constants.change
exports.sync = constants.sync
exports.connect = constants.connect
exports.disconnect = constants.disconnect
exports.failure = constants.failure

},{"./constants":18}],22:[function(require,module,exports){
'use strict'

// Modified base64 with "+" as "-" and "/" as "_".
var charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789-_'

var charsetLength = charset.length

// Should be a multiple of 3 to avoid padding characters.
var keyLength = 3 * 5

module.exports = function generateId () {
  var i, array = []

  for (i = 0; i < keyLength; i++)
    array.push(charset.charAt(Math.floor(Math.random() * charsetLength)))

  return array.join('')
}

},{}],23:[function(require,module,exports){
'use strict'

module.exports = {
  // Keys
  constants: require('./constants'),
  keys: require('./keys'),
  events: require('./events'),
  methods: require('./methods'),

  // Utility functions
  assign: require('./assign'),
  castToNumber: require('./cast_to_number'),
  castValue: require('./cast_value'),
  clone: require('./clone'),
  deepEqual: require('./deep_equal'),
  generateId: require('./generate_id'),
  applyUpdate: require('./apply_update'),

  // i18n
  message: require('./message'),

  // Typed responses
  responses: require('./response_classes'),
  errors: require('./errors'),
  successes: require('./success'),

  // Arrays
  filter: require('./array/filter'),
  find: require('./array/find'),
  includes: require('./array/includes'),
  map: require('./array/map'),
  pull: require('./array/pull'),
  reduce: require('./array/reduce'),
  unique: require('./array/unique')
}

},{"./apply_update":6,"./array/filter":7,"./array/find":8,"./array/includes":9,"./array/map":10,"./array/pull":11,"./array/reduce":12,"./array/unique":13,"./assign":14,"./cast_to_number":15,"./cast_value":16,"./clone":17,"./constants":18,"./deep_equal":19,"./errors":20,"./events":21,"./generate_id":22,"./keys":24,"./message":25,"./methods":27,"./response_classes":29,"./success":30}],24:[function(require,module,exports){
'use strict'

var constants = require('./constants')

exports.primary = constants.primary
exports.type = constants.type
exports.link = constants.link
exports.isArray = constants.isArray
exports.inverse = constants.inverse
exports.denormalizedInverse = constants.denormalizedInverse

},{"./constants":18}],25:[function(require,module,exports){
'use strict'

var languages = {
  en: require('./messages/en')
}

var key
for (key in languages)
  message[key] = languages[key]

module.exports = message


/**
 * Message function for i18n.
 *
 * @param {String} id
 * @param {String} language
 * @param {Object} [data]
 * @return {String}
 */
function message (id, language, data) {
  var genericMessage = 'GenericError'
  var self = this || message
  var str, key, subtag

  if (!self.hasOwnProperty(language)) {
    subtag = language && language.match(/.+?(?=-)/)
    if (subtag) subtag = subtag[0]
    if (self.hasOwnProperty(subtag)) language = subtag
    else language = self.defaultLanguage
  }

  str = self[language].hasOwnProperty(id) ?
    self[language][id] :
    self[language][genericMessage] || self.en[genericMessage]

  if (typeof str === 'string')
    for (key in data)
      str = str.replace('{' + key + '}', data[key])

  if (typeof str === 'function')
    str = str(data)

  return str
}

// Assign fallback language to "en".
Object.defineProperty(message, 'defaultLanguage', {
  value: 'en', writable: true
})

},{"./messages/en":26}],26:[function(require,module,exports){

module.exports = {
  GenericError: function(d) { return "An internal error occurred."; },
  MalformedRequest: function(d) { return "The request was malformed."; },
  InvalidBody: function(d) { return "The request body is invalid."; },
  SerializerNotFound: function(d) { return "The serializer for \"" + d.id + "\" does not exist."; },
  InputOnly: function(d) { return "Input only."; },
  InvalidID: function(d) { return "An ID is invalid."; },
  DateISO8601: function(d) { return "Date string must be an ISO 8601 formatted string."; },
  DateInvalid: function(d) { return "Date value is invalid."; },
  BufferEncoding: function(d) { return "Buffer value must be a " + d.bufferEncoding + "-encoded string."; },
  JSONParse: function(d) { return "Could not parse value as JSON."; },
  MissingPayload: function(d) { return "Payload is missing."; },
  SpecifiedIDs: function(d) { return "IDs should not be specified."; },
  InvalidURL: function(d) { return "Invalid URL."; },
  RelatedRecordNotFound: function(d) { return "A related record for the field \"" + d.field + "\" was not found."; },
  CreateRecordsInvalid: function(d) { return "There are no valid records to be created."; },
  CreateRecordsFail: function(d) { return "Records could not be created."; },
  CreateRecordMissingID: function(d) { return "An ID on a created record is missing."; },
  DeleteRecordsMissingID: function(d) { return "IDs are required for deleting records."; },
  DeleteRecordsInvalid: function(d) { return "A record to be deleted could not be found."; },
  DeleteRecordsFail: function(d) { return "Not all records specified could be deleted."; },
  UnspecifiedType: function(d) { return "The type is unspecified."; },
  InvalidType: function(d) { return "The requested type \"" + d.type + "\" is not a valid type."; },
  InvalidLink: function(d) { return "The field \"" + d.field + "\" does not define a link."; },
  InvalidMethod: function(d) { return "The method \"" + d.method + "\" is unrecognized."; },
  CollisionToOne: function(d) { return "Multiple records can not have the same to-one link value on the field \"" + d.field + "\"."; },
  CollisionDuplicate: function(d) { return "Duplicate ID \"" + d.id + "\" in the field \"" + d.field + "\"."; },
  UpdateRecordMissing: function(d) { return "A record to be updated could not be found."; },
  UpdateRecordsInvalid: function(d) { return "There are no valid updates."; },
  UpdateRecordMissingID: function(d) { return "An ID on an update is missing."; },
  EnforceArrayType: function(d) { return "The value of \"" + d.key + "\" is invalid, it must be an array with values of type \"" + d.type + "\"."; },
  EnforceArray: function(d) { return "The value of \"" + d.key + "\" is invalid, it must be an array."; },
  EnforceSameID: function(d) { return "An ID of \"" + d.key + "\" is invalid, it cannot be the same ID of the record."; },
  EnforceSingular: function(d) { return "The value of \"" + d.key + "\" can not be an array, it must be a singular value."; },
  EnforceValue: function(d) { return "The value of \"" + d.key + "\" is invalid, it must be a \"" + d.type + "\"."; },
  EnforceValueArray: function(d) { return "A value in the array of \"" + d.key + "\" is invalid, it must be a \"" + d.type + "\"."; },
  FieldsFormat: function(d) { return "Fields format is invalid. It may either be inclusive or exclusive, but not both."; },
  RecordExists: function(d) { return "A record with ID \"" + d.id + "\" already exists."; }
}

},{}],27:[function(require,module,exports){
'use strict'

var constants = require('./constants')

exports.find = constants.find
exports.create = constants.create
exports.update = constants.update
exports.delete = constants.delete

},{"./constants":18}],28:[function(require,module,exports){
'use strict'

// This object exists as a container for the Promise implementation. By
// default, it's the native one.
exports.Promise = Promise

},{}],29:[function(require,module,exports){
'use strict'

var errorClass = require('error-class')
var assign = require('./assign')


// Successes.
exports.OK = function OK (hash) { assign(this, hash) }
exports.Created = function Created (hash) { assign(this, hash) }
exports.Empty = function Empty (hash) { assign(this, hash) }


// Errors.
exports.BadRequestError = errorClass('BadRequestError')
exports.UnauthorizedError = errorClass('UnauthorizedError')
exports.ForbiddenError = errorClass('ForbiddenError')
exports.NotFoundError = errorClass('NotFoundError')
exports.MethodError = errorClass('MethodError')
exports.NotAcceptableError = errorClass('NotAcceptableError')
exports.ConflictError = errorClass('ConflictError')
exports.UnsupportedError = errorClass('UnsupportedError')
exports.UnprocessableError = errorClass('UnprocessableError')


// White-list native error types. The list is gathered from here:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/
// Reference/Global_Objects/Error
exports.nativeErrors = [
  Error, TypeError, ReferenceError, RangeError,
  SyntaxError, EvalError, URIError
]

},{"./assign":14,"error-class":48}],30:[function(require,module,exports){
'use strict'

var responseClass = require('./response_classes')

exports.OK = responseClass.OK
exports.Created = responseClass.Created
exports.Empty = responseClass.Empty

},{"./response_classes":29}],31:[function(require,module,exports){
'use strict'

window.fortune = require('./')

},{"./":32}],32:[function(require,module,exports){
'use strict'

var EventLite = require('event-lite')

// Local modules.
var memoryAdapter = require('./adapter/adapters/memory')
var AdapterSingleton = require('./adapter/singleton')
var validate = require('./record_type/validate')
var ensureTypes = require('./record_type/ensure_types')
var promise = require('./common/promise')
var internalRequest = require('./request')
var middlewares = internalRequest.middlewares

// Static re-exports.
var Adapter = require('./adapter')
var common = require('./common')
var assign = common.assign
var methods = common.methods
var events = common.events


/**
 * This is the default export of the `fortune` package. It implements a
 * [subset of `EventEmitter`](https://www.npmjs.com/package/event-lite), and it
 * has a few static properties attached to it that may be useful to access:
 *
 * - `Adapter`: abstract base class for the Adapter.
 * - `adapters`: included adapters, defaults to memory adapter.
 * - `errors`: custom error types, useful for throwing errors in I/O hooks.
 * - `methods`: a hash that maps to string constants. Available are: `find`,
 *   `create`, `update`, and `delete`.
 * - `events`: names for events on the Fortune instance. Available are:
 *   `change`, `sync`, `connect`, `disconnect`, `failure`.
 * - `message`: a function which accepts the arguments (`id`, `language`,
 *   `data`). It has properties keyed by two-letter language codes, which by
 *   default includes only `en`.
 * - `Promise`: assign this to set the Promise implementation that Fortune
 *   will use.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune))
    return new Fortune(recordTypes, options)

  this.constructor(recordTypes, options)
}


// Inherit from EventLite class.
Fortune.prototype = new EventLite()


/**
 * Create a new instance, the only required input is record type definitions.
 * The first argument must be an object keyed by name, valued by definition
 * objects.
 *
 * Here are some example field definitions:
 *
 * ```js
 * {
 *   // Top level keys are names of record types.
 *   person: {
 *     // Data types may be singular or plural.
 *     name: String, // Singular string value.
 *     luckyNumbers: Array(Number), // Array of numbers.
 *
 *     // Relationships may be singular or plural. They must specify which
 *     // record type it refers to, and may also specify an inverse field
 *     // which is optional but recommended.
 *     pets: [ Array('animal'), 'owner' ], // Has many.
 *     employer: [ 'organization', 'employees' ], // Belongs to.
 *     likes: Array('thing'), // Has many (no inverse).
 *     doing: 'activity', // Belongs to (no inverse).
 *
 *     // Reflexive relationships are relationships in which the record type,
 *     // the first position, is of the same type.
 *     following: [ Array('person'), 'followers' ],
 *     followers: [ Array('person'), 'following' ],
 *
 *     // Mutual relationships are relationships in which the inverse,
 *     // the second position, is defined to be the same field on the same
 *     // record type.
 *     friends: [ Array('person'), 'friends' ],
 *     spouse: [ 'person', 'spouse' ]
 *   }
 * }
 * ```
 *
 * The above shows the shorthand which will be transformed internally to a
 * more verbose data structure. The internal structure is as follows:
 *
 * ```js
 * {
 *   person: {
 *     // A singular value.
 *     name: { type: String },
 *
 *     // An array containing values of a single type.
 *     luckyNumbers: { type: Number, isArray: true },
 *
 *     // Creates a to-many link to `animal` record type. If the field `owner`
 *     // on the `animal` record type is not an array, this is a many-to-one
 *     // relationship, otherwise it is many-to-many.
 *     pets: { link: 'animal', isArray: true, inverse: 'owner' },
 *
 *     // The `min` and `max` keys are open to interpretation by the specific
 *     // adapter, which may introspect the field definition.
 *     thing: { type: Number, min: 0, max: 100 },
 *
 *     // Nested field definitions are invalid. Use `Object` type instead.
 *     nested: { thing: { ... } } // Will throw an error.
 *   }
 * }
 * ```
 *
 * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
 * `Object`, and `Buffer`. Note that the `Object` type should be a JSON
 * serializable object that may be persisted. The only other allowed type is
 * a `Function`, which may be used to define custom types.
 *
 * A custom type function should accept one argument, the value, and return a
 * boolean based on whether the value is valid for the type or not. It may
 * optionally have a method `compare`, used for sorting in the built-in
 * adapters. The `compare` method should have the same signature as the native
 * `Array.prototype.sort`.
 *
 * A custom type function must inherit one of the allowed native types. For
 * example:
 *
 * ```js
 * function Integer (x) { return (x | 0) === x }
 * Integer.prototype = new Number()
 * ```
 *
 * The options object may contain the following keys:
 *
 * - `adapter`: configuration array for the adapter. The default type is the
 *   memory adapter. If the value is not an array, its settings will be
 *   considered omitted.
 *
 *   ```js
 *   {
 *     adapter: [
 *       // Must be a class that extends `Fortune.Adapter`, or a function
 *       // that accepts the Adapter class and returns a subclass. Required.
 *       Adapter => { ... },
 *
 *       // An options object that is specific to the adapter. Optional.
 *       { ... }
 *     ]
 *   }
 *   ```
 *
 * - `hooks`: keyed by type name, valued by an array containing an `input`
 *   and/or `output` function at indices `0` and `1` respectively.
 *
 *   A hook function takes at least two arguments, the internal `context`
 *   object and a single `record`. A special case is the `update` argument for
 *   the `update` method.
 *
 *   There are only two kinds of hooks, before a record is written (input),
 *   and after a record is read (output), both are optional. If an error occurs
 *   within a hook function, it will be forwarded to the response. Use typed
 *   errors to provide the appropriate feedback.
 *
 *   For a create request, the input hook may return the second argument
 *   `record` either synchronously, or asynchronously as a Promise. The return
 *   value of a delete request is inconsequential, but it may return a value or
 *   a Promise. The `update` method accepts a `update` object as a third
 *   parameter, which may be returned synchronously or as a Promise.
 *
 *   An example hook to apply a timestamp on a record before creation, and
 *   displaying the timestamp in the server's locale:
 *
 *   ```js
 *   {
 *     recordType: [
 *       (context, record, update) => {
 *         switch (context.request.method) {
 *           case 'create':
 *             record.timestamp = new Date()
 *             return record
 *           case 'update': return update
 *           case 'delete': return null
 *         }
 *       },
 *       (context, record) => {
 *         record.timestamp = record.timestamp.toLocaleString()
 *         return record
 *       }
 *     ]
 *   }
 *   ```
 *
 *   Requests to update a record will **NOT** have the updates already applied
 *   to the record.
 *
 *   Another feature of the input hook is that it will have access to a
 *   temporary field `context.transaction`. This is useful for ensuring that
 *   bulk write operations are all or nothing. Each request is treated as a
 *   single transaction.
 *
 * - `documentation`: an object mapping names to descriptions. Note that there
 *   is only one namepspace, so field names can only have one description.
 *   This is optional, but useful for the HTML serializer, which also emits
 *   this information as micro-data.
 *
 *   ```js
 *   {
 *     documentation: {
 *       recordType: 'Description of a type.',
 *       fieldName: 'Description of a field.',
 *       anotherFieldName: {
 *         en: 'Two letter language code indicates localized description.'
 *       }
 *     }
 *   }
 *   ```
 *
 * - `settings`: internal settings to configure.
 *
 *   ```js
 *   {
 *     settings: {
 *       // Whether or not to enforce referential integrity. This may be
 *       // useful to disable on the client-side.
 *       enforceLinks: true,
 *
 *       // Name of the application used for display purposes.
 *       name: 'My Awesome Application',
 *
 *       // Description of the application used for display purposes.
 *       description: 'media type "application/vnd.micro+json"'
 *     }
 *   }
 *   ```
 *
 * The return value of the constructor is the instance itself.
 *
 * @param {Object} [recordTypes]
 * @param {Object} [options]
 * @return {Fortune}
 */
Fortune.prototype.constructor = function Fortune (recordTypes, options) {
  var self = this
  var plainObject = {}
  var message = common.message
  var adapter, method, stack, flows, type, hooks, i, j

  if (recordTypes === void 0) recordTypes = {}
  if (options === void 0) options = {}

  if (!('adapter' in options)) options.adapter = [ memoryAdapter(Adapter) ]
  if (!('settings' in options)) options.settings = {}
  if (!('hooks' in options)) options.hooks = {}
  if (!('enforceLinks' in options.settings))
    options.settings.enforceLinks = true

  // Bind middleware methods to instance.
  flows = {}
  for (method in methods) {
    stack = [ middlewares[method], middlewares.include, middlewares.end ]

    for (i = 0, j = stack.length; i < j; i++)
      stack[i] = bindMiddleware(self, stack[i])

    flows[methods[method]] = stack
  }

  hooks = options.hooks

  // Validate hooks.
  for (type in hooks) {
    if (!recordTypes.hasOwnProperty(type)) throw new Error(
      'Attempted to define hook on "' + type + '" type ' +
      'which does not exist.')
    if (!Array.isArray(hooks[type]))
      throw new TypeError('Hook value for "' + type + '" type ' +
        'must be an array.')
  }

  // Validate record types.
  for (type in recordTypes) {
    if (type in plainObject)
      throw new Error('Can not define type name "' + type +
        '" which is in Object.prototype.')

    validate(recordTypes[type])
    if (!hooks.hasOwnProperty(type)) hooks[type] = []
  }

  /*!
   * Adapter singleton that is coupled to the Fortune instance.
   *
   * @type {Adapter}
   */
  adapter = new AdapterSingleton({
    adapter: options.adapter,
    recordTypes: recordTypes,
    hooks: hooks,
    message: message
  })

  self.options = options
  self.hooks = hooks
  self.recordTypes = recordTypes
  self.adapter = adapter

  // Internal properties.
  Object.defineProperties(self, {
    // 0 = not started, 1 = started, 2 = done.
    connectionStatus: { value: 0, writable: true },

    message: { value: message },
    flows: { value: flows }
  })
}


/**
 * This is the primary method for initiating a request. The options object
 * may contain the following keys:
 *
 * - `method`: The method is a either a function or a constant, which is keyed
 *   under `Fortune.common.methods` and may be one of `find`, `create`,
 *   `update`, or `delete`. Default: `find`.
 *
 * - `type`: Name of a type. **Required**.
 *
 * - `ids`: An array of IDs. Used for `find` and `delete` methods only. This is
 *   optional for the `find` method.
 *
 * - `include`: A 3-dimensional array specifying links to include. The first
 *   dimension is a list, the second dimension is depth, and the third
 *   dimension is an optional tuple with field and query options. For example:
 *   `[['comments'], ['comments', ['author', { ... }]]]`.
 *
 * - `options`: Exactly the same as the [`find` method](#adapter-find)
 *   options in the adapter. These options do not apply on methods other than
 *   `find`, and do not affect the records returned from `include`. Optional.
 *
 * - `meta`: Meta-information object of the request. Optional.
 *
 * - `payload`: Payload of the request. **Required** for `create` and `update`
 *   methods only, and must be an array of objects. The objects must be the
 *   records to create, or update objects as expected by the Adapter.
 *
 * - `transaction`: if an existing transaction should be re-used, this may
 *   optionally be passed in. This must be ended manually.
 *
 * The response object may contain the following keys:
 *
 * - `meta`: Meta-info of the response.
 *
 * - `payload`: An object containing the following keys:
 *   - `records`: An array of records returned.
 *   - `count`: Total number of records without options applied (only for
 *     responses to the `find` method).
 *   - `include`: An object keyed by type, valued by arrays of included
 *     records.
 *
 * The resolved response object should always be an instance of a response
 * type.
 *
 * @param {Object} options
 * @return {Promise}
 */
Fortune.prototype.request = function (options) {
  var self = this
  var connectionStatus = self.connectionStatus
  var Promise = promise.Promise

  if (connectionStatus === 0)
    return self.connect()
      .then(function () { return internalRequest.call(self, options) })

  else if (connectionStatus === 1)
    return new Promise(function (resolve, reject) {
      // Wait for changes to connection status.
      self.once(events.failure, function () {
        reject(new Error('Connection failed.'))
      })
      self.once(events.connect, function () {
        resolve(internalRequest.call(self, options))
      })
    })

  return internalRequest.call(self, options)
}


/**
 * The `find` method retrieves record by type given IDs, querying options,
 * or both. This is a convenience method that wraps around the `request`
 * method, see the `request` method for documentation on its arguments.
 *
 * @param {String} type
 * @param {*|*[]} [ids]
 * @param {Object} [options]
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.find = function (type, ids, options, include, meta) {
  var obj = { method: methods.find, type: type }

  if (ids) obj.ids = Array.isArray(ids) ? ids : [ ids ]
  if (options) obj.options = options
  if (include) obj.include = include
  if (meta) obj.meta = meta

  return this.request(obj)
}


/**
 * The `create` method creates records by type given records to create. This
 * is a convenience method that wraps around the `request` method, see the
 * request `method` for documentation on its arguments.
 *
 * @param {String} type
 * @param {Object|Object[]} records
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.create = function (type, records, include, meta) {
  var options = { method: methods.create, type: type,
    payload: Array.isArray(records) ? records : [ records ] }

  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
}


/**
 * The `update` method updates records by type given update objects. See the
 * [Adapter.update](#adapter-update) method for the format of the update
 * objects. This is a convenience method that wraps around the `request`
 * method, see the `request` method for documentation on its arguments.
 *
 * @param {String} type
 * @param {Object|Object[]} updates
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.update = function (type, updates, include, meta) {
  var options = { method: methods.update, type: type,
    payload: Array.isArray(updates) ? updates : [ updates ] }

  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
}


/**
 * The `delete` method deletes records by type given IDs (optional). This is a
 * convenience method that wraps around the `request` method, see the `request`
 * method for documentation on its arguments.
 *
 * @param {String} type
 * @param {*|*[]} [ids]
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.delete = function (type, ids, include, meta) {
  var options = { method: methods.delete, type: type }

  if (ids) options.ids = Array.isArray(ids) ? ids : [ ids ]
  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
}


/**
 * This method does not need to be called manually, it is automatically called
 * upon the first request if it is not connected already. However, it may be
 * useful if manually reconnect is needed. The resolved value is the instance
 * itself.
 *
 * @return {Promise}
 */
Fortune.prototype.connect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus === 1)
    return Promise.reject(new Error('Connection is in progress.'))

  else if (self.connectionStatus === 2)
    return Promise.reject(new Error('Connection is already done.'))

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    Object.defineProperty(self, 'denormalizedFields', {
      value: ensureTypes(self.recordTypes),
      writable: true,
      configurable: true
    })

    self.adapter.connect().then(function () {
      self.connectionStatus = 2
      self.emit(events.connect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 0
      self.emit(events.failure)
      return reject(error)
    })
  })
}


/**
 * Close adapter connection, and reset connection state. The resolved value is
 * the instance itself.
 *
 * @return {Promise}
 */
Fortune.prototype.disconnect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus !== 2)
    return Promise.reject(new Error('Instance has not been connected.'))

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    return self.adapter.disconnect().then(function () {
      self.connectionStatus = 0
      self.emit(events.disconnect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 2
      self.emit(events.failure)
      return reject(error)
    })
  })
}


// Useful for dependency injection. All instances of Fortune have the same
// common internal dependencies.
Fortune.prototype.common = common


// Assign useful static properties to the default export.
assign(Fortune, {
  Adapter: Adapter,
  adapters: {
    memory: memoryAdapter(Adapter)
  },
  errors: common.errors,
  message: common.message,
  methods: methods,
  events: events
})


// Set the `Promise` property.
Object.defineProperty(Fortune, 'Promise', {
  enumerable: true,
  get: function () {
    return promise.Promise
  },
  set: function (value) {
    promise.Promise = value
  }
})


// Internal helper function.
function bindMiddleware (scope, method) {
  return function (x) {
    return method.call(scope, x)
  }
}


module.exports = Fortune

},{"./adapter":4,"./adapter/adapters/memory":3,"./adapter/singleton":5,"./common":23,"./common/promise":28,"./record_type/ensure_types":34,"./record_type/validate":35,"./request":42,"event-lite":49}],33:[function(require,module,exports){
(function (Buffer){(function (){
'use strict'

var message = require('../common/message')
var find = require('../common/array/find')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var linkKey = keys.link
var isArrayKey = keys.isArray


// Check input values.
var checkInput = [
  [ String, function (value) {
    return typeof value === 'string'
  } ],
  [ Number, function (value) {
    return typeof value === 'number'
  } ],
  [ Boolean, function (value) {
    return typeof value === 'boolean'
  } ],
  [ Date, function (value) {
    return value && typeof value.getTime === 'function' &&
      !Number.isNaN(value.getTime())
  } ],
  [ Object, function (value) {
    return value !== null && typeof value === 'object'
  } ],
  [ Buffer, function (value) {
    return Buffer.isBuffer(value)
  } ]
]


/**
 * Throw errors for mismatched types on a record.
 *
 * @param {String} type
 * @param {Object} record
 * @param {Object} fields
 * @param {Object} meta
 * @return {Object}
 */
module.exports = function enforce (type, record, fields, meta) {
  var i, j, key, value, fieldDefinition, language

  if (!meta) meta = {}
  language = meta.language

  for (key in record) {
    fieldDefinition = fields[key]

    if (!fieldDefinition) {
      if (key !== primaryKey) delete record[key]
      continue
    }

    value = record[key]

    if (fieldDefinition[typeKey]) {
      if (fieldDefinition[isArrayKey]) {
        // If the field is defined as an array but the value is not,
        // then throw an error.
        if (!Array.isArray(value))
          throw new BadRequestError(message('EnforceArrayType', language, {
            key: key, type: fieldDefinition[typeKey].name
          }))

        for (i = 0, j = value.length; i < j; i++)
          checkValue(fieldDefinition, key, value[i], meta)
      }
      else checkValue(fieldDefinition, key, value, meta)

      continue
    }

    if (fieldDefinition[linkKey]) {
      if (fieldDefinition[isArrayKey]) {
        if (!Array.isArray(value))
          throw new BadRequestError(
            message('EnforceArray', language, { key: key }))

        if (type === fieldDefinition[linkKey] &&
          find(value, matchId(record[primaryKey])))
          throw new BadRequestError(
            message('EnforceSameID', language, { key: key }))

        continue
      }

      if (Array.isArray(value))
        throw new BadRequestError(
          message('EnforceSingular', language, { key: key }))

      if (type === fieldDefinition[linkKey] && record[primaryKey] === value)
        throw new BadRequestError(
          message('EnforceSameID', language, { key: key }))

      continue
    }
  }

  return record
}


function checkValue (field, key, value, meta) {
  var language = meta.language
  var check
  var type = field[typeKey]

  // Skip `null` case.
  if (value === null) return

  check = find(checkInput, function (pair) {
    return type && (pair[0] === type || pair[0].name === type.name)
  })
  if (check) check = check[1]
  else check = type

  // Fields may be nullable, but if they're defined, then they must be defined
  // properly.
  if (!check(value)) throw new BadRequestError(
    message(field[isArrayKey] ? 'EnforceValueArray' : 'EnforceValue',
      language, { key: key, type: type.displayName || type.name }))
}


function matchId (a) {
  return function (b) {
    return a === b
  }
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"../common/array/find":8,"../common/errors":20,"../common/keys":24,"../common/message":25,"buffer":47}],34:[function(require,module,exports){
'use strict'

var keys = require('../common/keys')
var linkKey = keys.link
var inverseKey = keys.inverse
var isArrayKey = keys.isArray
var denormalizedInverseKey = keys.denormalizedInverse


// Generate denormalized inverse field name.
var denormalizedPrefix = '__'
var denormalizedDelimiter = '_'
var denormalizedPostfix = '_inverse'


/**
 * Analyze the `types` object to see if `link` and `inverse` values are
 * valid. Also assign denormalized inverse fields.
 *
 * @param {Object} types
 * @return {Object}
 */
module.exports = function ensureTypes (types) {
  var denormalizedFields = {}
  var type, field, definition, linkedFields,
    denormalizedField, denormalizedDefinition

  for (type in types)
    for (field in types[type]) {
      definition = types[type][field]

      if (!(linkKey in definition)) continue

      if (!types.hasOwnProperty(definition[linkKey]))
        throw new Error('The value for "' + linkKey + '" on "' + field +
          '" in type "' + type +
          '" is invalid, the record type does not exist.')

      linkedFields = types[definition[linkKey]]

      if (inverseKey in definition) {
        if (!linkedFields.hasOwnProperty(definition[inverseKey]))
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" in type "' + type + '" is invalid, the field does not exist.')

        if (linkedFields[definition[inverseKey]][inverseKey] !== field)
          throw new Error('The value for "' + inverseKey + '" on "' + field +
            '" in type "' + type +
            '" is invalid, the inversely related field must define its ' +
            'inverse as "' + field + '".')

        if (linkedFields[definition[inverseKey]][linkKey] !== type)
          throw new Error('The value for "' + linkKey + '" on "' + field +
            '" in type "' + type +
            '" is invalid, the inversely related field must define its link ' +
            'as "' + type + '".')

        continue
      }

      // Need to assign denormalized inverse. The denormalized inverse field
      // is basically an automatically assigned inverse field that should
      // not be visible to the client, but exists in the data store.
      denormalizedField = denormalizedPrefix + type +
        denormalizedDelimiter + field + denormalizedPostfix

      denormalizedFields[denormalizedField] = true

      Object.defineProperty(definition, inverseKey, {
        value: denormalizedField
      })

      denormalizedDefinition = {}
      denormalizedDefinition[linkKey] = type
      denormalizedDefinition[inverseKey] = field
      denormalizedDefinition[isArrayKey] = true
      denormalizedDefinition[denormalizedInverseKey] = true

      Object.defineProperty(linkedFields, denormalizedField, {
        value: denormalizedDefinition,
        writable: true,
        configurable: true
      })
    }

  return denormalizedFields
}

},{"../common/keys":24}],35:[function(require,module,exports){
(function (Buffer){(function (){
'use strict'

var find = require('../common/array/find')
var map = require('../common/array/map')

var keys = require('../common/keys')
var primaryKey = keys.primary
var typeKey = keys.type
var linkKey = keys.link
var inverseKey = keys.inverse
var isArrayKey = keys.isArray

var plainObject = {}
var nativeTypes = [ String, Number, Boolean, Date, Object, Buffer ]
var stringifiedTypes = map(nativeTypes, function (nativeType) {
  return nativeType.name && nativeType.name.toLowerCase()
})


/**
 * Given a hash of field definitions, validate that the definitions are in the
 * correct format.
 *
 * @param {Object} fields
 * @return {Object}
 */
module.exports = function validate (fields) {
  var key

  if (typeof fields !== 'object')
    throw new TypeError('Type definition must be an object.')

  for (key in fields) validateField(fields, key)

  return fields
}


/**
 * Parse a field definition.
 *
 * @param {Object} fields
 * @param {String} key
 */
function validateField (fields, key) {
  var value = fields[key] = castShorthand(fields[key])

  if (typeof value !== 'object')
    throw new TypeError('The definition of "' + key + '" must be an object.')

  if (key === primaryKey)
    throw new Error('Can not define primary key "' + primaryKey + '".')

  if (key in plainObject)
    throw new Error('Can not define field name "' + key +
      '" which is in Object.prototype.')

  if (!value[typeKey] && !value[linkKey])
    throw new Error('The definition of "' + key + '" must contain either ' +
      'the "' + typeKey + '" or "' + linkKey + '" property.')

  if (value[typeKey] && value[linkKey])
    throw new Error('Can not define both "' + typeKey + '" and "' + linkKey +
      '" on "' + key + '".')

  if (value[typeKey]) {
    if (typeof value[typeKey] === 'string')
      value[typeKey] = nativeTypes[
        stringifiedTypes.indexOf(value[typeKey].toLowerCase())]

    if (typeof value[typeKey] !== 'function')
      throw new Error('The "' + typeKey + '" on "' + key +
        '" must be a function.')

    if (!find(nativeTypes, function (type) {
      var hasMatch = type === value[typeKey] ||
        type.name === value[typeKey].name

      // In case this errors due to security sandboxing, just skip this check.
      if (!hasMatch)
        try {
          hasMatch = Object.create(value[typeKey]) instanceof type
        }
        catch (e) {
          hasMatch = true
        }

      return hasMatch
    }))
      throw new Error('The "' + typeKey + '" on "' + key + '" must be or ' +
        'inherit from a valid native type.')

    if (value[inverseKey])
      throw new Error('The field "' + inverseKey + '" may not be defined ' +
        'on "' + key + '".')
  }

  if (value[linkKey]) {
    if (typeof value[linkKey] !== 'string')
      throw new TypeError('The "' + linkKey + '" on "' + key +
        '" must be a string.')

    if (value[inverseKey] && typeof value[inverseKey] !== 'string')
      throw new TypeError('The "' + inverseKey + '" on "' + key + '" ' +
        'must be a string.')
  }

  if (value[isArrayKey] && typeof value[isArrayKey] !== 'boolean')
    throw new TypeError('The key "' + isArrayKey + '" on "' + key + '" ' +
        'must be a boolean.')
}


/**
 * Cast shorthand definition to standard definition.
 *
 * @param {*} value
 * @return {Object}
 */
function castShorthand (value) {
  var obj

  if (typeof value === 'string') obj = { link: value }
  else if (typeof value === 'function') obj = { type: value }
  else if (Array.isArray(value)) {
    obj = {}

    if (value[1]) obj.inverse = value[1]
    else obj.isArray = true

    // Extract type or link.
    if (Array.isArray(value[0])) {
      obj.isArray = true
      value = value[0][0]
    }
    else value = value[0]

    if (typeof value === 'string') obj.link = value
    else if (typeof value === 'function') obj.type = value
  }
  else return value

  return obj
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"../common/array/find":8,"../common/array/map":10,"../common/keys":24,"buffer":47}],36:[function(require,module,exports){
'use strict'

var message = require('../common/message')
var promise = require('../common/promise')
var unique = require('../common/array/unique')
var map = require('../common/array/map')
var includes = require('../common/array/includes')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var keys = require('../common/keys')
var primaryKey = keys.primary
var linkKey = keys.link
var isArrayKey = keys.isArray
var inverseKey = keys.inverse

module.exports = checkLinks


/**
 * Ensure referential integrity by checking if related records exist.
 *
 * @param {Object} transaction
 * @param {Object} record
 * @param {Object} fields
 * @param {String[]} links - An array of strings indicating which fields are
 * links. Need to pass this so that it doesn't get computed each time.
 * @param {Object} [meta]
 * @return {Promise}
 */
function checkLinks (transaction, record, fields, links, meta) {
  var Promise = promise.Promise
  var enforceLinks = this.options.settings.enforceLinks

  return Promise.all(map(links, function (field) {
    var ids = Array.isArray(record[field]) ? record[field] :
      !record.hasOwnProperty(field) || record[field] === null ?
        [] : [ record[field] ]
    var fieldLink = fields[field][linkKey]
    var fieldInverse = fields[field][inverseKey]
    var findOptions = { fields: {} }

    // Don't need the entire records.
    findOptions.fields[fieldInverse] = true

    return new Promise(function (resolve, reject) {
      if (!ids.length) return resolve()

      return transaction.find(fieldLink, ids, findOptions, meta)

        .then(function (records) {
          var recordIds, i, j

          if (enforceLinks) {
            recordIds = unique(map(records, function (record) {
              return record[primaryKey]
            }))

            for (i = 0, j = ids.length; i < j; i++)
              if (!includes(recordIds, ids[i]))
                return reject(new BadRequestError(
                  message('RelatedRecordNotFound', meta.language,
                    { field: field })
                ))
          }

          return resolve(records)
        })
    })
  }))

    .then(function (partialRecords) {
      var object = {}, records, i, j

      for (i = 0, j = partialRecords.length; i < j; i++) {
        records = partialRecords[i]

        if (records) object[links[i]] =
        fields[links[i]][isArrayKey] ? records : records[0]
      }

      return object
    })
}

},{"../common/array/includes":9,"../common/array/map":10,"../common/array/unique":13,"../common/errors":20,"../common/keys":24,"../common/message":25,"../common/promise":28}],37:[function(require,module,exports){
'use strict'

var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var message = require('../common/message')
var promise = require('../common/promise')
var map = require('../common/array/map')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError

var updateHelpers = require('./update_helpers')
var scrubDenormalizedUpdates = updateHelpers.scrubDenormalizedUpdates
var getUpdate = updateHelpers.getUpdate
var addId = updateHelpers.addId
var removeId = updateHelpers.removeId

var constants = require('../common/constants')
var changeEvent = constants.change
var createMethod = constants.create
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray
var denormalizedInverseKey = constants.denormalizedInverse


/**
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var self = this
  var denormalizedFields = self.denormalizedFields
  var recordTypes = self.recordTypes
  var hooks = self.hooks
  var updates = {}
  var links = []
  var recordsLinked = []
  var transaction, records, type, meta, hook, fields, language

  // Start a promise chain.
  return Promise.resolve(context.request.payload)

    .then(function (payload) {
      var i, j, field

      records = payload

      if (!records || !records.length)
        throw new BadRequestError(
          message('CreateRecordsInvalid', language))

      type = context.request.type
      meta = context.request.meta
      transaction = context.transaction
      language = meta.language

      hook = hooks[type]
      fields = recordTypes[type]

      for (field in fields) {
        if (linkKey in fields[field])
          links.push(field)

        // Delete denormalized inverse fields.
        if (denormalizedInverseKey in fields[field])
          for (i = 0, j = records.length; i < j; i++)
            delete records[i][field]
      }

      return typeof hook[0] === 'function' ?
        Promise.all(map(records, function (record) {
          return hook[0](context, record)
        })) : records
    })

    .then(function (results) {
      return Promise.all(map(results, function (record, i) {
        if (record && typeof record === 'object') records[i] = record
        else record = records[i]

        // Enforce the fields.
        enforce(type, record, fields, meta)

        // Ensure referential integrity.
        return checkLinks.call(self, transaction, record, fields, links, meta)
          .then(function (linked) {
            // The created records should come back in the same order.
            recordsLinked.push(linked)
            return record
          })
      }))
    })

    .then(function () {
      validateRecords.call(self, records, fields, links, meta)
      return transaction.create(type, records, meta)
    })

    .then(function (createdRecords) {
      var record, field, inverseField, fieldIsArray,
        linked, linkedType, linkedIsArray, linkedIds, id,
        partialRecord, partialRecords
      var i, j, k, l, m, n, o, p

      // Update inversely linked records on created records.
      // Trying to batch updates to be as few as possible.
      var idCache = {}

      // Adapter must return something.
      if (!createdRecords.length)
        throw new BadRequestError(
          message('CreateRecordsFail', language))

      records = createdRecords

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      // Iterate over each record to generate updates object.
      for (i = 0, j = records.length; i < j; i++) {
        record = records[i]
        linked = recordsLinked[i]

        // Each created record must have an ID.
        if (!(primaryKey in record))
          throw new Error(
            message('CreateRecordMissingID', language))

        for (k = 0, l = links.length; k < l; k++) {
          field = links[k]
          inverseField = fields[field][inverseKey]

          if (!record.hasOwnProperty(field) || !inverseField) continue

          linkedType = fields[field][linkKey]
          linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]
          fieldIsArray = fields[field][isArrayKey]
          linkedIds = fieldIsArray ?
            record[field] : [ record[field] ]

          // Do some initialization.
          if (!updates[linkedType]) updates[linkedType] = []
          if (!idCache[linkedType]) idCache[linkedType] = {}

          for (m = 0, n = linkedIds.length; m < n; m++) {
            id = linkedIds[m]

            // Set related field.
            if (id !== null)
              addId(record[primaryKey],
                getUpdate(linkedType, id, updates, idCache),
                inverseField, linkedIsArray)

            // Unset 2nd degree related record for one-to-one case.
            if (!fieldIsArray &&
            linked[field] &&
            linked[field][inverseField] !== null &&
            !linkedIsArray &&
            linked[field][inverseField] !== record[primaryKey])
              removeId(id,
                getUpdate(
                  type, linked[field][inverseField], updates, idCache),
                field, linkedIsArray)
          }

          // Unset from 2nd degree related records for many-to-one case.
          if (fieldIsArray &&
          linked[field] && !linkedIsArray) {
            partialRecords = Array.isArray(linked[field]) ?
              linked[field] : [ linked[field] ]

            for (o = 0, p = partialRecords.length; o < p; o++) {
              partialRecord = partialRecords[o]

              if (partialRecord[inverseField] === record[primaryKey])
                continue

              removeId(partialRecord[primaryKey],
                getUpdate(
                  type, partialRecord[inverseField],
                  updates, idCache),
                field, fieldIsArray)
            }
          }
        }
      }

      return Promise.all(map(Object.keys(updates), function (type) {
        return updates[type].length ?
          transaction.update(type, updates[type], meta) :
          null
      }))
    })

    .then(function () {
      var eventData = {}, currentType

      eventData[createMethod] = {}
      eventData[createMethod][type] = records

      for (currentType in updates) {
        scrubDenormalizedUpdates(updates[currentType], denormalizedFields)

        if (!updates[currentType].length) continue

        if (!(updateMethod in eventData)) eventData[updateMethod] = {}
        eventData[updateMethod][currentType] = updates[currentType]
      }

      // Summarize changes during the lifecycle of the request.
      self.emit(changeEvent, eventData)

      return context
    })
}

},{"../common/array/map":10,"../common/constants":18,"../common/errors":20,"../common/message":25,"../common/promise":28,"../record_type/enforce":33,"./check_links":36,"./update_helpers":44,"./validate_records":45}],38:[function(require,module,exports){
'use strict'

var message = require('../common/message')
var promise = require('../common/promise')
var map = require('../common/array/map')

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError

var updateHelpers = require('./update_helpers')
var scrubDenormalizedUpdates = updateHelpers.scrubDenormalizedUpdates
var getUpdate = updateHelpers.getUpdate
var removeId = updateHelpers.removeId

var constants = require('../common/constants')
var changeEvent = constants.change
var deleteMethod = constants.delete
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray


/**
 * Delete records. This does not mutate context.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var self = this
  var denormalizedFields = self.denormalizedFields
  var request = context.request
  var type = request.type
  var ids = request.ids
  var meta = request.meta
  var language = meta.language
  var recordTypes = self.recordTypes
  var hooks = self.hooks
  var updates = {}
  var fields = recordTypes[type]
  var hook = hooks[type]
  var links = []
  var transaction, field, records

  transaction = context.transaction

  for (field in fields)
    if (linkKey in fields[field]) links.push(field)

  // In case of deletion, denormalized inverse fields must be updated.
  for (field in denormalizedFields)
    // Since denormalizedFields contains fields from ALL types, need to
    // qualify if it is on this type or not.
    if (field in fields) links.push(field)

  if (!ids || !ids.length)
    throw new NotFoundError(message('DeleteRecordsMissingID', language))

  return transaction.find(type, ids, null, meta)

    .then(function (foundRecords) {
      records = foundRecords

      if (records.length < ids.length)
        throw new NotFoundError(message('DeleteRecordsInvalid', language))

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      return typeof hook[0] === 'function' ?
        Promise.all(map(records, function (record) {
          return hook[0](context, record)
        })) : records
    })

    .then(function () {
      return transaction.delete(type, ids, meta)
    })

    .then(function (count) {
      var i, j, k, l, m, n, record, field, id, inverseField,
        linkedType, linkedIsArray, linkedIds

      // Remove all instances of the deleted IDs in all records.
      var idCache = {}

      // Sanity check.
      if (count < ids.length)
        throw new Error(message('DeleteRecordsFail', language))

      // Loop over each record to generate updates object.
      for (i = 0, j = records.length; i < j; i++) {
        record = records[i]

        for (k = 0, l = links.length; k < l; k++) {
          field = links[k]
          inverseField = fields[field][inverseKey]

          if (!record.hasOwnProperty(field) || !inverseField) continue

          linkedType = fields[field][linkKey]
          linkedIsArray = recordTypes[linkedType][inverseField][isArrayKey]
          linkedIds = Array.isArray(record[field]) ?
            record[field] : [ record[field] ]

          // Do some initialization.
          if (!updates[linkedType]) updates[linkedType] = []
          if (!idCache[linkedType]) idCache[linkedType] = {}

          for (m = 0, n = linkedIds.length; m < n; m++) {
            id = linkedIds[m]
            if (id !== null)
              removeId(record[primaryKey],
                getUpdate(linkedType, id, updates, idCache),
                inverseField, linkedIsArray)
          }
        }
      }

      return Promise.all(map(Object.keys(updates), function (type) {
        return updates[type].length ?
          transaction.update(type, updates[type], meta) :
          null
      }))
    })

    .then(function () {
      var eventData = {}, currentType

      eventData[deleteMethod] = {}
      eventData[deleteMethod][type] = ids

      for (currentType in updates) {
        scrubDenormalizedUpdates(updates[currentType], denormalizedFields)

        if (!updates[currentType].length) continue

        if (!(updateMethod in eventData)) eventData[updateMethod] = {}
        eventData[updateMethod][currentType] = updates[currentType]
      }

      // Summarize changes during the lifecycle of the request.
      self.emit(changeEvent, eventData)

      return context
    })
}

},{"../common/array/map":10,"../common/constants":18,"../common/errors":20,"../common/message":25,"../common/promise":28,"./update_helpers":44}],39:[function(require,module,exports){
'use strict'

var map = require('../common/array/map')
var promise = require('../common/promise')


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
        request.includeType = includeType

        return Promise.all(map(include[includeType], function (record) {
          return Promise.resolve(
            typeof hooks[includeType][1] === 'function' ?
              hooks[includeType][1](context, record) : record)
        }))
      }))

        .then(function (types) {
          var i, j, k, l

          // Don't need this anymore.
          delete request.includeType

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

},{"../common/array/map":10,"../common/promise":28}],40:[function(require,module,exports){
'use strict'

/**
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var transaction = context.transaction
  var request = context.request
  var type = request.type
  var ids = request.ids
  var options = request.options
  var meta = request.meta

  if (!type) return context

  return transaction.find(type, ids, options, meta)
    .then(function (records) {
      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      return context
    })
}

},{}],41:[function(require,module,exports){
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

},{"../common/array/find":8,"../common/array/map":10,"../common/array/reduce":12,"../common/errors":20,"../common/keys":24,"../common/message":25,"../common/promise":28}],42:[function(require,module,exports){
'use strict'

var promise = require('../common/promise')
var assign = require('../common/assign')
var unique = require('../common/array/unique')
var message = require('../common/message')

var responseClass = require('../common/response_classes')
var BadRequestError = responseClass.BadRequestError
var NotFoundError = responseClass.NotFoundError
var MethodError = responseClass.MethodError
var OK = responseClass.OK
var Empty = responseClass.Empty
var Created = responseClass.Created

var methods = require('../common/methods')
var findMethod = methods.find
var createMethod = methods.create


/*!
 * Internal function to send a request. Must be called in the context of
 * the Fortune instance.
 *
 * @param {Object} options
 * @return {Promise}
 */
function internalRequest (options) {
  var Promise = promise.Promise
  var flows = this.flows
  var recordTypes = this.recordTypes
  var adapter = this.adapter

  var context = setDefaults(options)
  var method = context.request.method
  var hasTransaction = 'transaction' in options

  // Start a promise chain.
  return Promise.resolve(context)

    .then(function (context) {
      var type = context.request.type
      var ids = context.request.ids
      var language = context.request.meta.language
      var error

      // Make sure that IDs are an array of unique values.
      if (ids) context.request.ids = unique(ids)

      // If a type is unspecified, block the request.
      if (type === null) {
        error = new BadRequestError(message('UnspecifiedType', language))
        error.isTypeUnspecified = true
        throw error
      }

      // If a type is specified and it doesn't exist, block the request.
      if (!recordTypes.hasOwnProperty(type))
        throw new NotFoundError(
          message('InvalidType', language, { type: type }))

      // Block invalid method.
      if (!(method in flows))
        throw new MethodError(
          message('InvalidMethod', language, { method: method }))

      return hasTransaction ?
        Promise.resolve(options.transaction) :
        adapter.beginTransaction()
    })

    .then(function (transaction) {
      var chain, flow, i, j

      context.transaction = transaction
      chain = Promise.resolve(context)
      flow = flows[method]

      for (i = 0, j = flow.length; i < j; i++)
        chain = chain.then(flow[i])

      return chain
    })

    .then(function (context) {
      return hasTransaction ?
        Promise.resolve() : context.transaction.endTransaction()
          .then(function () {
            var method = context.request.method
            var response = context.response
            var payload = response.payload

            if (!payload) return new Empty(response)
            if (method === createMethod) return new Created(response)

            return new OK(response)
          })
    })

  // This makes sure to call `endTransaction` before re-throwing the error.
    .catch(function (error) {
      return 'transaction' in context && !hasTransaction ?
        context.transaction.endTransaction(error)
          .then(throwError, throwError) :
        throwError()

      function throwError () {
        throw assign(error, context.response)
      }
    })
}


// Re-exporting internal middlewares.
internalRequest.middlewares = {
  create: require('./create'),
  'delete': require('./delete'),
  update: require('./update'),
  find: require('./find'),
  include: require('./include'),
  end: require('./end')
}


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaults (options) {
  var context = {
    request: {
      method: findMethod,
      type: null,
      ids: null,
      options: {},
      include: [],
      meta: {},
      payload: null
    },
    response: {
      meta: {},
      payload: null
    }
  }

  assign(context.request, options)

  return context
}


module.exports = internalRequest

},{"../common/array/unique":13,"../common/assign":14,"../common/message":25,"../common/methods":27,"../common/promise":28,"../common/response_classes":29,"./create":37,"./delete":38,"./end":39,"./find":40,"./include":41,"./update":43}],43:[function(require,module,exports){
'use strict'

var deepEqual = require('../common/deep_equal')
var promise = require('../common/promise')
var assign = require('../common/assign')
var clone = require('../common/clone')
var validateRecords = require('./validate_records')
var checkLinks = require('./check_links')
var enforce = require('../record_type/enforce')
var message = require('../common/message')
var applyUpdate = require('../common/apply_update')

var updateHelpers = require('./update_helpers')
var scrubDenormalizedUpdates = updateHelpers.scrubDenormalizedUpdates
var getUpdate = updateHelpers.getUpdate
var addId = updateHelpers.addId
var removeId = updateHelpers.removeId

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError
var BadRequestError = errors.BadRequestError

var find = require('../common/array/find')
var includes = require('../common/array/includes')
var map = require('../common/array/map')

var constants = require('../common/constants')
var changeEvent = constants.change
var updateMethod = constants.update
var primaryKey = constants.primary
var linkKey = constants.link
var inverseKey = constants.inverse
var isArrayKey = constants.isArray
var denormalizedInverseKey = constants.denormalizedInverse
var updateRecordKey = constants.updateRecord
var linkedHashKey = constants.linkedHash


/**
 * Do updates. First, it must find the records to update, then run hooks
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var Promise = promise.Promise
  var self = this
  var denormalizedFields = self.denormalizedFields
  var adapter = self.adapter
  var recordTypes = self.recordTypes
  var hooks = self.hooks

  var relatedUpdates = {}
  var hookedUpdates = []

  var links = []
  var transaction, updates, fields, hook, type, meta, language

  // Start a promise chain.
  return Promise.resolve(context.request.payload)

    .then(function (payload) {
      var i, j, update, field

      updates = payload
      validateUpdates(updates, context.request.meta)

      type = context.request.type
      meta = context.request.meta
      transaction = context.transaction
      language = meta.language

      fields = recordTypes[type]
      hook = hooks[type]

      // Delete denormalized inverse fields, can't be updated.
      for (field in fields) {
        if (linkKey in fields[field]) links.push(field)
        if (denormalizedInverseKey in fields[field])
          for (i = 0, j = updates.length; i < j; i++) {
            update = updates[i]
            if (update.replace) delete update.replace[field]
            if (update.pull) delete update.pull[field]
            if (update.push) delete update.push[field]
          }
      }

      return transaction.find(type, map(updates, function (update) {
        return update[primaryKey]
      }), null, meta)
    })

    .then(function (records) {
      if (records.length < updates.length)
        throw new NotFoundError(message('UpdateRecordMissing', language))

      return Promise.all(map(records, function (record) {
        var update, cloneUpdate
        var hasHook = typeof hook[0] === 'function'
        var id = record[primaryKey]

        update = find(updates, function (update) {
          return update[primaryKey] === id
        })

        if (!update) throw new NotFoundError(
          message('UpdateRecordMissing', language))

        if (hasHook) cloneUpdate = clone(update)

        return Promise.resolve(hasHook ?
          hook[0](context, record, update) : update)
          .then(function (result) {
            if (result && typeof result === 'object') update = result

            if (hasHook) {
              // Check if the update has been modified or not.
              if (!deepEqual(update, cloneUpdate))
                context.response.meta.updateModified = true

              // Runtime safety check: primary key must be the same.
              if (update[primaryKey] !== id) throw new BadRequestError(
                message('InvalidID', language))
            }

            hookedUpdates.push(update)
            Object.defineProperty(update, updateRecordKey, { value: record })

            // Shallow clone the record.
            record = assign({}, record)

            // Apply updates to record.
            applyUpdate(record, update)

            // Apply operators to record.
            if (update.operate)
              record = adapter.applyOperators(record, update.operate)

            // Enforce the fields.
            enforce(type, record, fields, meta)

            // Ensure referential integrity.
            return checkLinks.call(
              self, transaction, record, fields, links, meta)
              .then(function (linked) {
                Object.defineProperty(update, linkedHashKey, { value: linked })
                return record
              })
          })
      }))
    })

    .then(function (records) {
      var i, j

      validateRecords.call(self, records, fields, links, meta)

      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      // Drop fields in the updates that aren't defined in the record type
      // before doing the update.
      for (i = 0, j = hookedUpdates.length; i < j; i++)
        dropFields(hookedUpdates[i], fields)

      return transaction.update(type, hookedUpdates, meta)
    })

    .then(function () {
      var inverseField, isArray, linkedType, linkedIsArray, linked, record,
        partialRecord, partialRecords, ids, id, push, pull, update, field
      var i, j, k, l, m, n

      // Build up related updates based on update objects.
      var idCache = {}

      // Iterate over each update to generate related updates.
      for (i = 0, j = hookedUpdates.length; i < j; i++) {
        update = hookedUpdates[i]

        for (k = 0, l = links.length; k < l; k++) {
          field = links[k]
          inverseField = fields[field][inverseKey]

          if (!inverseField) continue

          isArray = fields[field][isArrayKey]
          linkedType = fields[field][linkKey]
          linkedIsArray =
          recordTypes[linkedType][inverseField][isArrayKey]

          // Do some initialization.
          if (!relatedUpdates[linkedType]) relatedUpdates[linkedType] = []
          if (!idCache[linkedType]) idCache[linkedType] = {}

          record = update[updateRecordKey]
          linked = update[linkedHashKey]

          // Replacing a link field is pretty complicated.
          if (update.replace && update.replace.hasOwnProperty(field)) {
            id = update.replace[field]

            if (!Array.isArray(id)) {
            // Don't need to worry about inverse updates if the value does not
            // change.
              if (id === record[field]) continue

              // Set related field.
              if (id !== null)
                addId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)

              // Unset 2nd degree related record.
              if (linked[field] &&
              linked[field][inverseField] !== null &&
              !linkedIsArray &&
              linked[field][inverseField] !== update[primaryKey])
                removeId(id,
                  getUpdate(
                    type, linked[field][inverseField],
                    relatedUpdates, idCache),
                  field, linkedIsArray)

              // For unsetting, remove ID from related record.
              if (record[field] !== null &&
              record[field] !== update[field] &&
              record[field] !== id)
                removeId(update[primaryKey],
                  getUpdate(
                    linkedType, record[field], relatedUpdates, idCache),
                  inverseField, linkedIsArray)

              // After this point, there's no need to go over push/pull.
              continue
            }

            ids = id

            // Compute differences for pull, and mutate the update.
            for (m = 0, n = record[field].length; m < n; m++) {
              id = record[field][m]
              if (!includes(ids, id)) {
                if (!('pull' in update)) update.pull = {}
                if (update.pull.hasOwnProperty(field)) {
                  if (Array.isArray(update.pull[field])) {
                    update.pull[field].push(id)
                    continue
                  }
                  update.pull[field] = [ update.pull[field], id ]
                  continue
                }
                update.pull[field] = [ id ]
              }
            }

            // Compute differences for push, and mutate the update.
            for (m = 0, n = ids.length; m < n; m++) {
              id = ids[m]
              if (!includes(record[field], id)) {
                if (!('push' in update)) update.push = {}
                if (update.push.hasOwnProperty(field)) {
                  if (Array.isArray(update.push[field])) {
                    update.push[field].push(id)
                    continue
                  }
                  update.push[field] = [ update.push[field], id ]
                  continue
                }
                update.push[field] = [ id ]
              }
            }

            // Delete the original replace, since it is no longer valid.
            delete update.replace[field]
          }

          if (update.pull && update.pull[field]) {
            pull = Array.isArray(update.pull[field]) ?
              update.pull[field] : [ update.pull[field] ]

            for (m = 0, n = pull.length; m < n; m++) {
              id = pull[m]
              if (id !== null)
                removeId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)
            }
          }

          if (update.push && update.push[field]) {
            push = Array.isArray(update.push[field]) ?
              update.push[field] : [ update.push[field] ]

            for (m = 0, n = push.length; m < n; m++) {
              id = push[m]
              if (id !== null)
                addId(update[primaryKey],
                  getUpdate(linkedType, id, relatedUpdates, idCache),
                  inverseField, linkedIsArray)
            }
          }

          // Unset from 2nd degree related records.
          if (linked[field] && !linkedIsArray) {
            partialRecords = Array.isArray(linked[field]) ?
              linked[field] : [ linked[field] ]

            for (m = 0, n = partialRecords.length; m < n; m++) {
              partialRecord = partialRecords[m]

              if (partialRecord[inverseField] === update[primaryKey])
                continue

              removeId(partialRecord[primaryKey],
                getUpdate(
                  type, partialRecord[inverseField],
                  relatedUpdates, idCache),
                field, isArray)
            }
          }
        }
      }

      return Promise.all(map(Object.keys(relatedUpdates), function (type) {
        return relatedUpdates[type].length ?
          transaction.update(type, relatedUpdates[type], meta) :
          null
      }))
    })

    .then(function () {
      var eventData = {}, linkedType

      eventData[updateMethod] = {}
      eventData[updateMethod][type] = hookedUpdates

      for (linkedType in relatedUpdates) {
        scrubDenormalizedUpdates(
          relatedUpdates[linkedType], denormalizedFields)

        if (!relatedUpdates[linkedType].length) continue

        if (linkedType !== type)
          eventData[updateMethod][linkedType] = relatedUpdates[linkedType]

        // Get the union of update IDs.
        else eventData[updateMethod][type] =
        eventData[updateMethod][type].concat(relatedUpdates[type])
      }

      // Summarize changes during the lifecycle of the request.
      self.emit(changeEvent, eventData)

      return context
    })
}


// Validate updates.
function validateUpdates (updates, meta) {
  var language = meta.language
  var i, j, update

  if (!updates || !updates.length)
    throw new BadRequestError(
      message('UpdateRecordsInvalid', language))

  for (i = 0, j = updates.length; i < j; i++) {
    update = updates[i]
    if (!update[primaryKey])
      throw new BadRequestError(
        message('UpdateRecordMissingID', language))
  }
}


function dropFields (update, fields) {
  var field

  for (field in update.replace)
    if (!fields.hasOwnProperty(field)) delete update.replace[field]

  for (field in update.pull)
    if (!fields.hasOwnProperty(field)) delete update.pull[field]

  for (field in update.push)
    if (!fields.hasOwnProperty(field)) delete update.push[field]
}

},{"../common/apply_update":6,"../common/array/find":8,"../common/array/includes":9,"../common/array/map":10,"../common/assign":14,"../common/clone":17,"../common/constants":18,"../common/deep_equal":19,"../common/errors":20,"../common/message":25,"../common/promise":28,"../record_type/enforce":33,"./check_links":36,"./update_helpers":44,"./validate_records":45}],44:[function(require,module,exports){
'use strict'

var find = require('../common/array/find')

var keys = require('../common/keys')
var primaryKey = keys.primary


// Get a related update object by ID, or return a new one if not found.
exports.getUpdate = function (type, id, updates, cache) {
  var update

  if (cache[type] && cache[type][id])
    return find(updates[type],
      function (update) {
        return update[primaryKey] === id
      })

  update = { id: id }
  if (!updates[type]) updates[type] = []
  updates[type].push(update)
  if (!cache[type]) cache[type] = {}
  cache[type][id] = true
  return update
}


// Add an ID to an update object.
exports.addId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.push) update.push = {}
    if (!update.push[field]) update.push[field] = []
    update.push[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = id
}


// Remove an ID from an update object.
exports.removeId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.pull) update.pull = {}
    if (!update.pull[field]) update.pull[field] = []
    update.pull[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = null
}


// Remove denormalized fields from appearing in updates on change events.
exports.scrubDenormalizedUpdates = function (updates, denormalizedFields) {
  var i, update, operation, field

  // Iterate in reverse, so we can easily remove indices in the array.
  for (i = updates.length; i--;) {
    update = updates[i]

    for (operation in update) {
      if (operation === primaryKey) continue

      for (field in update[operation])
        if (field in denormalizedFields)
          delete update[operation][field]

      if (!Object.keys(update[operation]).length)
        delete update[operation]
    }

    // If only the primary key is present, then remove the entire update.
    if (Object.keys(update).length === 1) updates.splice(i, 1)
  }
}

},{"../common/array/find":8,"../common/keys":24}],45:[function(require,module,exports){
'use strict'

var message = require('../common/message')

var errors = require('../common/errors')
var ConflictError = errors.ConflictError

var keys = require('../common/keys')
var linkKey = keys.link
var isArrayKey = keys.isArray
var inverseKey = keys.inverse

/**
 * Do some validation on records to be created or updated to determine
 * if there are any records which have overlapping to-one relationships,
 * or non-unique array relationships.
 *
 * @param {Object[]} records
 * @param {Object} fields
 * @param {Object} links
 * @param {Object} meta
 */
module.exports = function validateRecords (records, fields, links, meta) {
  var recordTypes = this.recordTypes
  var language = meta.language
  var toOneMap = {}
  var i, j, k, l, m, n, value, field, record, id, ids, seen,
    fieldLink, fieldInverse, fieldIsArray, inverseIsArray

  for (i = 0, j = links.length; i < j; i++) {
    field = links[i]
    fieldLink = fields[field][linkKey]
    fieldInverse = fields[field][inverseKey]
    fieldIsArray = fields[field][isArrayKey]
    inverseIsArray = recordTypes[fieldLink][fieldInverse][isArrayKey]

    if (fieldIsArray)
      for (k = 0, l = records.length; k < l; k++) {
        record = records[k]
        if (!Array.isArray(record[field])) continue
        ids = record[field]
        seen = {}

        for (m = 0, n = ids.length; m < n; m++) {
          id = ids[m]
          if (seen.hasOwnProperty(id)) throw new ConflictError(
            message('CollisionDuplicate', language, { id: id, field: field }))
          else seen[id] = true
        }
      }

    if (!inverseIsArray) {
      toOneMap[field] = {}

      for (k = 0, l = records.length; k < l; k++) {
        record = records[k]
        value = record[field]
        ids = Array.isArray(value) ? value : value ? [ value ] : []

        for (m = 0, n = ids.length; m < n; m++) {
          id = ids[m]
          if (!toOneMap[field].hasOwnProperty(id)) toOneMap[field][id] = true
          else throw new ConflictError(
            message('CollisionToOne', language, { field: field }))
        }
      }
    }
  }
}

},{"../common/errors":20,"../common/keys":24,"../common/message":25}],46:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],47:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":46,"buffer":47,"ieee754":50}],48:[function(require,module,exports){
'use strict'

var hasCaptureStackTrace = 'captureStackTrace' in Error

module.exports = errorClass


function errorClass (name) {
  var ErrorClass

  if (!name || typeof name !== 'string')
    throw new TypeError('Argument "name" must be a non-empty string.')

  // This is basically `eval`, there's no other way to dynamically define a
  // function name.
  ErrorClass = function CustomError () {
    if (!(this instanceof CustomError))
      return new (CustomError.bind.apply(CustomError,
        Array.prototype.concat.apply([ null ], arguments)))
    setupError.apply(this, arguments)
  }

  ErrorClass.prototype = Object.create(Error.prototype, {
    constructor: nonEnumerableProperty(ErrorClass),
    name: nonEnumerableProperty(name)
  })

  return ErrorClass
}


// Internal function to set up an error.
function setupError (message) {
  if (hasCaptureStackTrace)
    // V8 specific method.
    Error.captureStackTrace(this, this.constructor)
  else
    // Generic way to set the error stack trace.
    Object.defineProperty(this, 'stack',
      nonEnumerableProperty(Error(message).stack))

  // Use the `+` operator with an empty string to implicitly type cast the
  // `message` argument into a string.
  Object.defineProperty(this, 'message',
    nonEnumerableProperty(message !== void 0 ? '' + message : ''))
}


function nonEnumerableProperty (value) {
  // The field `enumerable` is `false` by default.
  return {
    value: value,
    writable: true,
    configurable: true
  }
}

},{}],49:[function(require,module,exports){
/**
 * event-lite.js - Light-weight EventEmitter (less than 1KB when gzipped)
 *
 * @copyright Yusuke Kawasaki
 * @license MIT
 * @constructor
 * @see https://github.com/kawanet/event-lite
 * @see http://kawanet.github.io/event-lite/EventLite.html
 * @example
 * var EventLite = require("event-lite");
 *
 * function MyClass() {...}             // your class
 *
 * EventLite.mixin(MyClass.prototype);  // import event methods
 *
 * var obj = new MyClass();
 * obj.on("foo", function() {...});     // add event listener
 * obj.once("bar", function() {...});   // add one-time event listener
 * obj.emit("foo");                     // dispatch event
 * obj.emit("bar");                     // dispatch another event
 * obj.off("foo");                      // remove event listener
 */

function EventLite() {
  if (!(this instanceof EventLite)) return new EventLite();
}

(function(EventLite) {
  // export the class for node.js
  if ("undefined" !== typeof module) module.exports = EventLite;

  // property name to hold listeners
  var LISTENERS = "listeners";

  // methods to export
  var methods = {
    on: on,
    once: once,
    off: off,
    emit: emit
  };

  // mixin to self
  mixin(EventLite.prototype);

  // export mixin function
  EventLite.mixin = mixin;

  /**
   * Import on(), once(), off() and emit() methods into target object.
   *
   * @function EventLite.mixin
   * @param target {Prototype}
   */

  function mixin(target) {
    for (var key in methods) {
      target[key] = methods[key];
    }
    return target;
  }

  /**
   * Add an event listener.
   *
   * @function EventLite.prototype.on
   * @param type {string}
   * @param func {Function}
   * @returns {EventLite} Self for method chaining
   */

  function on(type, func) {
    getListeners(this, type).push(func);
    return this;
  }

  /**
   * Add one-time event listener.
   *
   * @function EventLite.prototype.once
   * @param type {string}
   * @param func {Function}
   * @returns {EventLite} Self for method chaining
   */

  function once(type, func) {
    var that = this;
    wrap.originalListener = func;
    getListeners(that, type).push(wrap);
    return that;

    function wrap() {
      off.call(that, type, wrap);
      func.apply(this, arguments);
    }
  }

  /**
   * Remove an event listener.
   *
   * @function EventLite.prototype.off
   * @param [type] {string}
   * @param [func] {Function}
   * @returns {EventLite} Self for method chaining
   */

  function off(type, func) {
    var that = this;
    var listners;
    if (!arguments.length) {
      delete that[LISTENERS];
    } else if (!func) {
      listners = that[LISTENERS];
      if (listners) {
        delete listners[type];
        if (!Object.keys(listners).length) return off.call(that);
      }
    } else {
      listners = getListeners(that, type, true);
      if (listners) {
        listners = listners.filter(ne);
        if (!listners.length) return off.call(that, type);
        that[LISTENERS][type] = listners;
      }
    }
    return that;

    function ne(test) {
      return test !== func && test.originalListener !== func;
    }
  }

  /**
   * Dispatch (trigger) an event.
   *
   * @function EventLite.prototype.emit
   * @param type {string}
   * @param [value] {*}
   * @returns {boolean} True when a listener received the event
   */

  function emit(type, value) {
    var that = this;
    var listeners = getListeners(that, type, true);
    if (!listeners) return false;
    var arglen = arguments.length;
    if (arglen === 1) {
      listeners.forEach(zeroarg);
    } else if (arglen === 2) {
      listeners.forEach(onearg);
    } else {
      var args = Array.prototype.slice.call(arguments, 1);
      listeners.forEach(moreargs);
    }
    return !!listeners.length;

    function zeroarg(func) {
      func.call(that);
    }

    function onearg(func) {
      func.call(that, value);
    }

    function moreargs(func) {
      func.apply(that, args);
    }
  }

  /**
   * @ignore
   */

  function getListeners(that, type, readonly) {
    if (readonly && !that[LISTENERS]) return;
    var listeners = that[LISTENERS] || (that[LISTENERS] = {});
    return listeners[type] || (listeners[type] = []);
  }

})(EventLite);

},{}],50:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],51:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}]},{},[31]);
