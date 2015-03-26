var RSVP = require('rsvp');
var _ = require('lodash');
var moment = require("moment");
var Promise = RSVP.Promise;
var adapter = {};
var neo4j = require('neo4j');

adapter._init = function (options) {
  // var connectionString = options.connectionString;

  // if (!connectionString || !connectionString.length) {
  //   connectionString = 'mongodb://' +
  //     (options.username ? options.username + ':' + options.password + '@' : '') +
  //     options.host + (options.port ? ':' + options.port : '') + '/' + options.db;
  // }

  // mongoose.set('debug', options.debug);

  //Setup mongoose instance
  this.db = new neo4j.GraphDatabase('http://localhost:7474');
  
};

/**
 * Store models in an object here.
 *
 * @api private
 */
adapter._models = {};

adapter.schema = function (name, schema, options, schemaCallback) {
  options = options || {};

  console.log("neo4j schema", name, schema, options);

  if (schemaCallback)
    schemaCallback(schema);

  return schema;

};

adapter.model = function(name, schema, options) {

  console.log("neo4j model", name, schema, options);

};

adapter.create = function (model, id, resource) {
  var _this = this;

  console.log("neo4j create", model, id, resource);

};

adapter.update = function (model, id, update) {

  console.log("neo4j update", model, id, update);

};

adapter.markDeleted = function(model, id){
  console.log("neo4j markDeleted", model, id);
};

adapter.delete = function (model, id) {
  console.log("neo4j create", model, id);
};

/**
 *
 * @param model {Model}
 * @param query {Object}
 * @param projection {Object}
 * @returns {Promise}
 */
adapter.find = function(model, query, projection){
  console.log("neo4j find", model, query, projection);
};

/**
 * @param model {Model || String}
 * @param query {Object}
 * //@param limit {Number} - deprecated as unused
 * @param projection {Object}
 * @returns {Promise}
 */

adapter.findMany = function(model, query, projection) {
  console.log("neo4j findMany", model, query, projection);
}

adapter.count = function(model, query, projection) {
  console.log("neo4j count", model, query, projection);
}

adapter.parseQuery = function(model, query){
  console.log("neo4j parseQuery", model, query, projection);
};

adapter.awaitConnection = function () {
  var _this = this;
  console.log("neo4j awaitConnection");
};

/**
 * Parse incoming resource.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @return {Object}
 */
adapter._serialize = function (model, resource) {

  console.log("neo4j _serialize", model, resource);

  return { id : "1" };
};

/**
 * Return a resource ready to be sent back to client.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource mongoose document
 * @return {Object}
 */
adapter._deserialize = function (model, resource) {
  var json = {};
  console.log("neo4j _deserialize", model, resource);

  return { id : "1" };
};

/**
 * What happens after the DB has been written to, successful or not.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @param {Object} error
 * @param {Function} resolve
 * @param {Function} reject
 * @param {Array} modifiedRefs
 */
adapter._handleWrite = function (model, resource, error, resolve, reject, modifiedRefs) {
  console.log("neo4j _handleWrite");
};

/**
 * This method is designed to parse update command and return a list of paths that
 * will be modified by given update command.
 * It was introduced to handle relationship updates it a more neat way when only
 * modified paths trigger update of related documents.
 * It's NOT guaranteed to return ALL modified paths. Only that are of interest to _updateRelationships method
 * @param {Object} update
 * @private
 */
adapter._getModifiedRefs = function(update){
  console.log("neo4j _getModifiedRefs");
};

/**
 * Update relationships manually. By nature of NoSQL,
 * relations don't come for free. Don't try this at home, kids.
 * You've been warned!
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @param {Array} modifiedRefs
 * @return {Promise}
 */
adapter._updateRelationships = function (model, resource, modifiedRefs) {
  console.log("neo4j _updateRelationships");
};

/**
 * Update one-to-one mapping.
 *
 * @api private
 * @parameter {Object} relatedModel
 * @parameter {Object} resource
 * @parameter {Object} reference
 * @parameter {Object} field
 * @return {Promise}
 */

adapter._updateOneToOne = function(model, relatedModel, resource, reference, field) {
  console.log("neo4j _updateOneToOne");
};

/**
 * Update one-to-many mapping.
 *
 * @api private
 * @parameter {Object} relatedModel
 * @parameter {Object} resource
 * @parameter {Object} reference
 * @parameter {Object} field
 * @return {Promise}
 */
adapter._updateOneToMany = function(model, relatedModel, resource, reference, field) {
  console.log("neo4j _updateOneToMany");
};

/**
 * Update many-to-one mapping.
 *
 * @api private
 * @parameter {Object} model - model that has many-to-one ref
 * @parameter {Object} relatedModel - model with corresponding one-to-many ref
 * @parameter {Object} resource - resource currently being updated
 * @parameter {Object} reference - this model reference schema
 * @parameter {Object} field - related model reference schema
 * @return {Promise}
 */
adapter._updateManyToOne = function(model, relatedModel, resource, reference, field) {
  console.log("neo4j _updateManyToOne");
};

/**
 * Update many-to-many mapping.
 *
 * @api private
 * @parameter {Object} relatedModel
 * @parameter {Object} resource
 * @parameter {Object} reference
 * @parameter {Object} field
 * @return {Promise}
 */
adapter._updateManyToMany = function(model, relatedModel, resource, reference, field) {
  console.log("neo4j _updateManyToMany");
};

/**
 * Remove all associations from a resource.
 *
 * @api private
 * @parameter {Object} model
 * @parameter {Object} resource
 * @return {Object}
 */
adapter._dissociate = function (model, resource) {
  console.log("neo4j _dissociate");
};

/**
 * Determine whether we should perform an upsert (ie. pass {upsert : true} to
 * Mongoose) if certain keys exist in the schema's resource.
 *
 * @api private
 * @parameter {Object} model
 * @parameter {Object} resource
 * @parameter {Object} ops
 * @return {Object}
 */
adapter._shouldUpsert = function(model, resource, opts) {
  console.log("neo4j _shouldUpsert");
};

module.exports = adapter;