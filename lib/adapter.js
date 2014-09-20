/**
 * Adapter is an object containing methods to be implemented.
 */
function Adapter () {
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
 * @param {String} name name of the collection
 * @param {String|Array} [id]
 * @param {Object|String|Array} query
 */
Adapter.prototype.find = function (name, id, query) {

};


/**
 * Create a document.
 *
 * @param {String} name name of the collection
 * @param {Object} document
 */
Adapter.prototype.create = function (name, document) {

};


/**
 * Update a document.
 *
 * @param {String} name name of the collection
 * @param {String} id
 * @param {Object} update
 */
Adapter.prototype.update = function (name, id, update) {

};


/**
 * Delete a document.
 *
 * @param {String} name name of the collection
 * @param {String} id
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


module.exports = Adapter;
