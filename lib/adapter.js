var Promise = require('promise');


module.exports = Adapter;


/**
 * Adapter is an object containing methods to be implemented.
 */
function Adapter (context) {
  var adapter = context.options.adapter;
  var key;

  if (typeof adapter === 'string') {
    try {
      adapter = require('./adapters/' + adapter + '/');
    } catch (error) {
      adapter = require(adapter);
    }
  }

  for (key in Object.getPrototypeOf(this)) {
    if (adapter.hasOwnProperty(key)) {
      this[key] = adapter[key];
    }
  }

  this.init.apply(this, arguments);
}


/**
 * Establish database connection.
 */
Adapter.prototype.init = function () {

};


/**
 * Find documents. The format of the query may be as follows:
 *
 * ```js
 * {
 *   find: { ... },
 *   sort: { ... },
 *   fields: { ... },
 *   match: { ... },
 *   limit: 1000,
 *   offset: 0
 * }
 * ```
 *
 * The syntax of the `find` object depends on the specific adapter.
 * The `match` object should be merged with `find` if it exists, though
 * `find` should take precedence.
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
 * @param {Object} [query]
 * @return {Promise}
 */
Adapter.prototype.find = function (type, ids, query) {

};


/**
 * Create a document.
 *
 * @param {String} type
 * @param {Object} document
 * @return {Promise}
 */
Adapter.prototype.create = function (type, document) {

};


/**
 * Update a document.
 *
 * @param {String} type
 * @param {String} id
 * @param {Object} update
 * @return {Promise}
 */
Adapter.prototype.update = function (type, id, update) {

};


/**
 * Delete a document.
 *
 * @param {String} type
 * @param {String} id
 * @return {Promise}
 */
Adapter.prototype.delete = function (type, id) {

};


/**
 * Wait for database connection.
 *
 * @return {Promise}
 */
Adapter.prototype.awaitConnection = function () {
  return Promise.resolve();
};
