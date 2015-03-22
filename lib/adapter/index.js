import keys from '../schema/reserved_keys';
import errors from '../common/errors';
import primaryKey from '../common/primary_key';


/**
 * Adapter is a class containing methods to be implemented.
 * All records returned by the adapter must have the primary key.
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
   * Find records. The format of the options may be as follows:
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
   * If `ids` is specified, then only the `fields` option should be valid.
   *
   * The syntax of the `filter` object depends on the specific adapter.
   * The `match` object should be merged with `filter` if it exists, though
   * `match` should take precedence.
   *
   * The syntax of the `sort` object is as follows:
   *
   * ```js
   * {
   *   "person": { // name of type
   *     "age": -1 // descending
   *     "name": 1 // ascending
   *   }
   * }
   * ```
   *
   * The syntax of the `fields` object is as follows:
   *
   * ```js
   * {
   *   "person": { // name of type
   *     "name": 1 // include this field
   *   }
   * }
   * ```
   *
   * The syntax of the `match` object is straightforward:
   *
   * ```js
   * {
   *   "key": "value", // exact match
   *   "array": ["value1", "value2"], // containment, not deep equality
   * }
   * ```
   *
   * The return value of the promise should be an array. If IDs are specified,
   * the returned array's records should correspond to the requested IDs. The
   * returned array may also have properties such as `total` which may help
   * serializers communicate to the client.
   *
   * @param {String} type
   * @param {Array} [ids]
   * @param {Object} [options]
   * @return {Promise}
   */
  find () {
    return Promise.resolve([]);
  }


  /**
   * Update records. Success does not need to return any value.
   * The `updates` parameter should be an array of objects that correspond
   * to updates by ID. Each update object must be as follows:
   *
   * ```js
   * {
   *   // ID to update. Required.
   *   id: undefined,
   *
   *   // Replace keys with values. Key will be added if it doesn't exist.
   *   replace: {},
   *
   *   // Add values to array or object, or add a key if it doesn't exist.
   *   // Array values should be appended to existing arrays.
   *   add: {},
   *
   *   // Remove values from array or object, or remove a key entirely.
   *   // Array values should be removed from existing arrays.
   *   remove: {},
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
   * Delete records. Success does not return any value.
   *
   * @param {String} type
   * @param {Array} ids
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
