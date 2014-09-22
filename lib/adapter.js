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


Adapter.prototype.init = function () {

};


/**
 * Find documents. The format of the query may be as follows:
 *
 * ```js
 * {
 *   query: { ... },
 *   sort: { ... },
 *   fields: { ... },
 *   limit: 1000,
 *   offset: 0
 * }
 * ```
 *
 * The exact syntax of the query object depends on the specific adapter.
 *
 * @param {String} name
 * @param {String|Array} [id]
 * @param {Object|String|Array} query
 * @return {Promise}
 */
Adapter.prototype.find = function (name, id, query) {

};


/**
 * Create a document.
 *
 * @param {String} name
 * @param {Object} document
 * @return {Promise}
 */
Adapter.prototype.create = function (name, document) {

};


/**
 * Update a document.
 *
 * @param {String} name
 * @param {String} id
 * @param {Object} update
 * @return {Promise}
 */
Adapter.prototype.update = function (name, id, update) {

};


/**
 * Delete a document.
 *
 * @param {String} name
 * @param {String} id
 * @return {Promise}
 */
Adapter.prototype.delete = function (name, id) {

};


/**
 * Wait for database connection.
 *
 * @return {Promise}
 */
Adapter.prototype.awaitConnection = function () {

};
