import noop from './utils/noop';

/**
 * Adapter is a class containing methods to be implemented.
 */
export default class Adapter {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * Establish database connection. This method should not to be
   * called manually.
   *
   * @return {Promise}
   */
  init () {
    return noop();
  }

  /**
   * Create a document.
   *
   * @param {String} type
   * @param {Object} document
   * @return {Promise}
   */
  create () {
    return noop();
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
   *   "person": { // type in singular form if inflected
   *     "age": -1 // descending
   *     "name": 1 // ascending
   *   }
   * }
   * ```
   *
   * The syntax of the `match` object is straightforward:
   *
   * ```js
   * {
   *   "key": "value",
   *   "array": ["value1", "value2"]
   * }
   * ```
   *
   * @param {String} type
   * @param {Array} [ids]
   * @param {Object} [options]
   * @return {Promise}
   */
  read () {
    return noop();
  }

  /**
   * Update a document.
   *
   * @param {String} type
   * @param {String} id
   * @param {Object} update
   * @return {Promise}
   */
  update () {
    return noop();
  }

  /**
   * Delete a document.
   *
   * @param {String} type
   * @param {String} id
   * @return {Promise}
   */
  delete () {
    return noop();
  }

}


/**
 * A proxy for the adapter. For internal use.
 */
export class AdapterProxy extends Adapter {
  constructor (context) {
    var adapter = context.options.adapter.type;

    // Coerce an object into its prototype.
    if (typeof adapter === 'function') {
      adapter = adapter.prototype;
    }

    super(Object.assign(adapter, {
      options: context.options.adapter.options || {},
      schemas: context.schemas
    }));
  }
}
