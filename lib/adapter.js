var RSVP = require('rsvp')
  , mongodb = require('./adapters/mongodb')
  , relational = require('./adapters/relational');

// Pre-defined adapters
var adapters = {
  mongodb: mongodb,
  mysql: relational,
  psql: relational,
  postgres: relational,
  sqlite: relational
};

/*!
 * Adapter for persistence layers. Adapters must implement a
 * private `_init` method, as well as a few methods that are
 * accessed publicly:
 *
 * ```
 * schema, model, create, update, delete, find, findMany
 * ```
 *
 * @param {Object} options
 * @constructor
 */
function Adapter(options) {
  var key;
  if(
    typeof options.adapter == 'string' &&
    adapters.hasOwnProperty(options.adapter)
  ) {
    for(key in adapters[options.adapter]) {
      this.__proto__[key] = adapters[options.adapter][key];
    }
  } else if(typeof options.adapter == 'object') {
    for(key in options.adapter) {
      this.__proto__[key] = options.adapter[key];
    }
  } else {
    throw new Error('Missing or invalid database adapter.');
  }
  this._init(options);
}


/**
 * Constructor method.
 *
 * @api private
 */
Adapter.prototype._init = function() {};

/**
 * Transform fortune schema into a schema or model of the underlying adapter.
 *
 * @param {String} name the name of the resource
 * @param {Object} schema an object in the Fortune schema format
 * @param {Object} [options] optional schema options to pass to the adapter
 * @return {Object}
 */
Adapter.prototype.schema = function() {};

/**
 * Set up the underlying model. If no schema is passed, it returns an existing model.
 *
 * @param {String} name the name of the resource
 * @param {Object} [schema] if no schema is passed, this returns a model with the corresponding name
 * @return {Object}
 */
Adapter.prototype.model = function() {};

/**
 * Create a resource, with an optional ID.
 *
 * @param {String|Object} model either a string or the underlying model
 * @param {String} [id] the resource ID
 * @param {Object} resource a single resource in JSON API format
 * @return {Promise}
 */
Adapter.prototype.create = function() { return stubPromise(); };

/**
 * Update a resource by ID.
 *
 * @param {String|Object} model either a string or the underlying model
 * @param {String} id the resource ID
 * @param {Object} update a partial resource in JSON API format
 * @return {Promise}
 */
Adapter.prototype.update = function() { return stubPromise(); };

/**
 * Delete a resource by ID.
 *
 * @param {String|Object} model either a string or the underlying model
 * @param {String} id the resource ID
 * @return {Promise}
 */
Adapter.prototype.delete = function() { return stubPromise(); };

/**
 * Find a single resource by ID or arbitrary query.
 *
 * @param {String|Object} model if the model is a string, it looks up the model based it's name
 * @param {String|Object} query if the query is a string, then it is assumed that it's the ID
 * @return {Promise}
 */
Adapter.prototype.find = function() { return stubPromise(); };

/**
 * Find multiple resources by IDs or an arbitrary query.
 *
 * @param {String|Object} model either a string or the underlying model
 * @param {Array|Object} query either an array of IDs, or a query object
 * @param {Number} [limit] limit the number of resources to send back. Default: 1,000
 * @return {Promise}
 */
Adapter.prototype.findMany = function() { return stubPromise(); };

/**
 * Sometimes we need to wait for the database connection first.
 * This is a stub method that should return a promise, and it should
 * only be implemented if the need arises.
 *
 * @return {Promise}
 */
Adapter.prototype.awaitConnection = function() { return stubPromise(); };


function stubPromise() {
  console.warn('Warning: method not implemented.');
  return new RSVP.Promise(function(resolve) {
    resolve();
  });
}

exports = module.exports = Adapter;
exports.adapters = adapters;
