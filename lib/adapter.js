/**
 * Adapter is a class containing methods to be implemented. In general,
 * all objects returned by the adapter should have a primary key.
 */
export default class Adapter {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * Establish database connection. This method should not be called
   * directly, and it should not accept any parameters. Options should
   * be specified before this is called and are available under
   * `this.options`, and schemas under `this.schemas`. This is the
   * time to do setup tasks like create tables, ensure indexes, etc.
   * On successful completion, it should return a promise with no value.
   *
   * @return {Promise}
   */
  init () {
    return Promise.resolve();
  }

  /**
   * Create entities. Success returns the newly created entities, ordered
   * in the same order of the `entities` array.
   *
   * @param {String} type
   * @param {Array} entities
   * @return {Promise}
   */
  create () {
    return Promise.resolve([{}]);
  }

  /**
   * Find entities. The format of the options may be as follows:
   *
   * ```js
   * {
   *   query: { ... },
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
   *   "array": ["value1", "value2"], // contains, not deep equality
   *   "object": { key: "value" } // exact match on nested key
   * }
   * ```
   *
   * The return value of the promise should be an array. If IDs are specified,
   * the results should be ordered in the same order of the IDs. The returned
   * array may also have properties such as `total` which may help serializers
   * communicate to the client.
   *
   * @param {String} type
   * @param {Array} [ids]
   * @param {Object} [options]
   * @return {Promise}
   */
  find () {
    return Promise.resolve([{}]);
  }

  /**
   * Update entities. Success returns the entire updated entities, ordered
   * in the same order of the `updates` array.
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
    return Promise.resolve([{}]);
  }

  /**
   * Delete entities. Success does not return any value.
   *
   * @param {String} type
   * @param {Array} ids
   * @return {Promise}
   */
  delete () {
    return Promise.resolve();
  }

}
