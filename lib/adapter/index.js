import keys from '../schema/reserved_keys';
import primaryKey from '../common/primary_key';
import errors from '../common/errors';


/**
 * Adapter is a class containing methods to be implemented. All records
 * returned by the adapter must have the primary key. It is generally not
 * needed to call any of the adapter methods manually.
 */
export default class Adapter {

  constructor () {
    Object.assign(this, { keys, errors, primaryKey }, ...arguments);
  }


  /**
   * This method is optional to implement if initialization is trivial.
   * The responsibility of this method is to ensure that the models
   * defined are consistent with the backing data store. If there is any
   * mismatch it should either try to reconcile differences or fail.
   * This method should not be called directly, and it should not accept any
   * parameters. Options should be specified before this is called and are
   * available under `this.options`, and schemas under `this.schemas`. This
   * is the time to do setup tasks like create tables, ensure indexes, etc.
   * On successful completion, it should return a promise with no value.
   *
   * @return {Promise}
   */
  initialize () {
    return Promise.resolve();
  }


  /**
   * Create records. Success returns the newly created records, ordered
   * in the same order of the `records` array.
   *
   * @param {String} type
   * @param {Array} records
   * @return {Promise}
   */
  create () {
    return Promise.resolve([]);
  }


  /**
   * Find records by ID, or options. If IDs is empty, it should try to return
   * all records. The format of the options may be as follows:
   *
   * ```js
   * {
   *   filter: { ... },
   *   sort: { ... },
   *   fields: { ... },
   *   match: { ... },
   *
   *   // Limit results to this number.
   *   limit: 1000,
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
    return Promise.resolve([]);
  }


  /**
   * Update records by ID. Success does not need to return any value.
   * The `updates` parameter should be an array of objects that correspond
   * to updates by ID. Each update object must be as follows:
   *
   * ```js
   * {
   *   // ID to update. Required.
   *   id: undefined,
   *
   *   // Replace field values. Field will be added if it doesn't exist.
   *   set: {},
   *
   *   // Remove fields, the value shouldn't matter.
   *   unset: {},
   *
   *   // Append values to an array field. If the value is an array, all of
   *   // the values should be pushed.
   *   push: {},
   *
   *   // Remove values from an array field. If the value is an array, all of
   *   // the values should be removed.
   *   pull: {},
   *
   *   // Optional, specific to the adapter. This should take precedence
   *   // over all of the above.
   *   operate: {}
   * }
   * ```
   *
   * @param {String} type
   * @param {Array} updates
   * @return {Promise}
   */
  update () {
    return Promise.resolve();
  }


  /**
   * Delete records by ID. Success does not return any value.
   *
   * @param {String} type
   * @param {Array} ids
   * @param {Object} [options]
   * @return {Promise}
   */
  delete () {
    return Promise.resolve();
  }


  /**
   * Begin a transaction to write to the data store. This method is optional
   * to implement, but useful for ACID. It should return a Promise containing
   * a transaction object with all of the adapter methods.
   *
   * @return {Promise}
   */
  beginTransaction () {
    return Promise.resolve(this);
  }


  /**
   * End a transaction. This method is optional to implement.
   * It should return a Promise with no value if the transaction is
   * completed successfully, or reject the promise if it failed.
   *
   * @return {Promise}
   */
  endTransaction () {
    return Promise.resolve();
  }

}
