import noop from './utils/noop';

/**
 * Adapter is a class containing methods to be implemented. In general,
 * all objects returned by the adapter must have an `id` key.
 */
export default class Adapter {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * Establish database connection. This method should not be called
   * manually, and it should not accept any parameters. Options should
   * be specified before this is called and are available under
   * `this.options`. On successful completion, it should not return
   * any value in the promise.
   *
   * @return {Promise}
   */
  init () {
    return noop();
  }

  /**
   * Create entities. Success returns the newly created entities.
   *
   * @param {String} type
   * @param {Array} entities
   * @return {Promise}
   */
  create () {
    return noop([]);
  }

  /**
   * Find documents. The format of the options may be as follows:
   *
   * ```js
   * {
   *   query: { ... },
   *   sort: { ... },
   *   fields: { ... },
   *   match: { ... },
   *   limit: 1000,
   *   offset: 0
   * }
   * ```
   *
   * The syntax of the `query` object depends on the specific adapter.
   * The `match` object should be merged with `query` if it exists, though
   * `query` should take precedence.
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
   *   "array": ["value1", "value2"] // contains these values
   * }
   * ```
   *
   * @param {String} type
   * @param {Array} [ids]
   * @param {Object} [options]
   * @return {Promise}
   */
  find () {
    return noop([]);
  }

  /**
   * Update entities. Success returns the entire updated entities.
   * The `updates` parameter should be an array of objects that correspond
   * to updates by ID. Each update object must be as follows:
   *
   * ```js
   * {
   *   // ID to update. Required.
   *   id: '',
   *
   *   // Replace keys with values. Key will be added if it doesn't exist.
   *   replace: {},
   *
   *   // Add values to array or object, or add a key if it doesn't exist.
   *   add: {},
   *
   *   // Remove values from array or object, or remove a key entirely.
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
    return noop({});
  }

  /**
   * Delete entities. Success does not return any value.
   *
   * @param {String} type
   * @param {Array} ids
   * @return {Promise}
   */
  delete () {
    return noop();
  }

}
