/**
 * Adapter is a class containing methods to be implemented. All records
 * returned by the adapter must have the primary key.
 */
export default class Adapter {

  constructor () {
    Object.assign(this, ...arguments)
  }


  /**
   * The responsibility of this method is to ensure that the record types
   * defined are consistent with the backing data store. If there is any
   * mismatch it should either try to reconcile differences or fail.
   * This method SHOULD NOT be called manually, and it should not accept any
   * parameters. Options should be specified before this is called and are
   * available under `this.options`, and schemas under `this.schemas`. This
   * is the time to do setup tasks like create tables, ensure indexes, etc.
   * On successful completion, it should resolve to no value.
   *
   * @return {Promise}
   */
  initialize () {
    return Promise.resolve()
  }


  /**
   * Close the database connection.
   *
   * @return {Promise}
   */
  close () {
    return Promise.resolve()
  }


  /**
   * Create records. A successful response resolves to the newly created
   * records.
   *
   * **IMPORTANT**: the record must have initial values for each field defined
   * in the schema. For non-array fields, it should be `null`, and for array
   * fields it should be `[]` (empty array).
   *
   * @param {String} type
   * @param {Array} records
   * @return {Promise}
   */
  create () {
    return Promise.resolve([])
  }


  /**
   * Find records by IDs and options. If IDs is empty, it should try to return
   * all records. The format of the options may be as follows:
   *
   * ```js
   * {
   *   filter: { ... },
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
   * The syntax of the `filter` object depends on the specific adapter.
   * The `match` object should be merged with `filter` if it exists, though
   * `match` should take precedence.
   *
   * The syntax of the `sort` object is as follows:
   *
   * ```js
   * {
   *   "age": -1, // descending
   *   "name": 1 // ascending
   * }
   * ```
   *
   * Fields can be specified to be either included or omitted, but not both.
   * Use the values `true` to include, or `false` to omit. The syntax of the
   * `fields` object is as follows:
   *
   * ```js
   * {
   *   "name": true, // include this field
   *   "age": true // also include this field
   * }
   * ```
   *
   * The syntax of the `match` object is straightforward:
   *
   * ```js
   * {
   *   "name": "value", // exact match or containment if array
   *   "friends": ["joe", "bob"], // match any one of these values
   * }
   * ```
   *
   * The return value of the promise should be an array.
   *
   * @param {String} type
   * @param {Array} ids
   * @param {Object} [options]
   * @return {Promise}
   */
  find () {
    return Promise.resolve([])
  }


  /**
   * Update records by IDs. Success does not need to resolve to any value.
   * The `updates` parameter should be an array of objects that correspond
   * to updates by IDs. Each update object must be as follows:
   *
   * ```js
   * {
   *   // ID to update. Required.
   *   id: undefined,
   *
   *   // Set a value of a field.
   *   set: { name: 'Bob' },
   *
   *   // Reset a field to null or empty array, the value shouldn't matter.
   *   unset: { age: true },
   *
   *   // Append values to an array field. If the value is an array, all of
   *   // the values should be pushed.
   *   push: { pets: 1 },
   *
   *   // Remove values from an array field. If the value is an array, all of
   *   // the values should be removed.
   *   pull: { friends: [2, 3] },
   *
   *   // The `operate` object is specific to the adapter. This should take
   *   // precedence over all of the above. Warning: using this bypasses schema
   *   // enforcement and referential integrity. Use at your own risk.
   *   operate: { ... }
   * }
   * ```
   *
   * To keep things simple, the same field is not allowed in multiple
   * operations at once.
   *
   * @param {String} type
   * @param {Array} updates
   * @return {Promise}
   */
  update () {
    return Promise.resolve()
  }


  /**
   * Delete records by IDs. Success does not need to resolve to any value.
   *
   * @param {String} type
   * @param {Array} ids
   * @param {Object} [options]
   * @return {Promise}
   */
  delete () {
    return Promise.resolve()
  }


  /**
   * Begin a transaction to write to the data store. This method is optional
   * to implement, but useful for ACID. It should resolve to an object
   * containing all of the adapter methods.
   *
   * @return {Promise}
   */
  beginTransaction () {
    return Promise.resolve(this)
  }


  /**
   * End a transaction. This method is optional to implement.
   * It should return a Promise with no value if the transaction is
   * completed successfully, or reject the promise if it failed.
   *
   * @return {Promise}
   */
  endTransaction () {
    return Promise.resolve()
  }

}
