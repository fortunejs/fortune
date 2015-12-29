'use strict'

var defineEnumerable = require('../common/define_enumerable')


/**
 * Adapter is an abstract base class containing methods to be implemented. All
 * records returned by the adapter must have the primary key `id`. The primary
 * key **MUST** be a string or a number.
 */
function Adapter (properties) {
  defineEnumerable(this, properties)
}


/**
 * The Adapter should not be instantiated directly, since the constructor
 * function accepts dependencies. The keys which are injected are:
 *
 * - `methods`: same as static property on Fortune class.
 * - `errors`: same as static property on Fortune class.
 * - `keys`: an object which enumerates reserved constants for record type
 * definitions.
 * - `recordTypes`: an object which enumerates record types and their
 * definitions.
 * - `options`: the options passed to the adapter.
 * - `message`: a function with the signature (`id`, `language`, `data`).
 * - `Promise`: the Promise implementation.
 *
 * These keys are accessible on the instance (`this`).
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
  return Promise.resolve()
}


/**
 * Close the database connection.
 *
 * @return {Promise}
 */
Adapter.prototype.disconnect = function () {
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
 *   match: { ... },
 *
 *   // Limit results to this number. Zero means no limit.
 *   limit: 0,
 *
 *   // Offset results by this much from the beginning.
 *   offset: 0
 * }
 * ```
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
 * The syntax of the `match` object is straightforward:
 *
 * ```js
 * {
 *   name: 'value', // exact match or containment if array
 *   friends: [ 'joe', 'bob' ] // match any one of these values
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
 *   // The `operate` object is specific to the adapter. This should take
 *   // precedence over all of the above. Warning: using this may bypass
 *   // field definitions and referential integrity. Use at your own risk.
 *   operate: { ... }
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
  return Promise.resolve()
}


/**
 * Apply operators on a record, then return the record. If you make use of
 * update operators, you should implement this method so that input transform
 * functions get records in the correct state. This method is optional to
 * implement.
 *
 * @param {Object} record
 * @param {Object} operators - The `operate` field on an `update` object.
 * @return {Object}
 */
Adapter.prototype.applyOperators = function (record) {
  return record
}


module.exports = Adapter
