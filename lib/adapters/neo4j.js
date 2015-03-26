var RSVP = require('rsvp');
var _ = require('lodash');
var moment = require("moment");
var Promise = RSVP.Promise;
var adapter = {};
var neo4j = require('neo4j');
var mongoose = require('mongoose');

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
_schema = {};

adapter.schema = function (name, schema, options, schemaCallback) {
  
  console.log("neo4j schema", name, schema, options);

  //TODO : Copied wholemeal from mongoDB - need to think about refactor & re-use
  options = options || {};

  var refkeys = [];
  var Mixed = mongoose.Schema.Types.Mixed;
  var pk = (options.model || {}).pk;

  _.each(schema, function (val, key) {
    var obj = {};
    var isArray = _.isArray(val);
    var value = isArray ? val[0] : val;
    var isObject = _.isPlainObject(value);
    var ref = isObject ? value.ref : value;
    var inverse = isObject ? value.inverse : undefined;
    var pkType = value.type || value.pkType || mongoose.Schema.Types.ObjectId;
    var fieldsToIndex = {};

    // Convert strings to associations
    if (typeof ref === 'string') {
      var field = _.extend(isObject ? value : {}, {
        ref: ref,
        inverse: inverse,
        type: pkType,
        external: !!value.external,
        alias: val.alias || null
      });

      schema[key] = isArray ? [field] : field;

      refkeys.push(key);
    }

    // Convert native object to schema type Mixed
    if (typeof value == 'function' && typeCheck(value) == 'object') {

      if (isObject) {
        schema[key].type = Mixed;
      } else {
        schema[key] = Mixed;
      }
    }
  });

  if(pk){
    if(_.isFunction(schema[pk])){
      schema[pk] = { type: schema[pk]};
    }else if(!(_.isObject(schema[pk]) && schema[pk].type)){
      throw new Error("Schema PK must either be a type function or an object with a "
                      + "`type` property");
    }

    _.extend(schema[pk], {index: {unique: true}});
  }

  schema = mongoose.Schema(schema, options);
  schema.refkeys = refkeys;

  _.each(refkeys, function(key){
    var index = {};
    index[key] = 1;

    schema.index(index);
  });

  //Set index on deletedAt
  schema.index({
    deletedAt: 1
  },{
    sparse: true
  });

  if (schemaCallback)
    schemaCallback(schema);

  _schema[name] = schema;

  return schema;

  function typeCheck(fn) {
    return Object.prototype.toString.call(new fn(''))
      .slice(1, -1).split(' ')[1].toLowerCase();
  }
};

adapter.model = function(name, schema, options) {

  console.log("neo4j model", name, schema, options);
  console.log(_.keys(_schema));

  // if(schema) {
  var model = _.clone(_schema[name]);
    // this._models[name] = model;
  return _.extend(model, options, { modelName : name});
  // } else {
  //   return this._models[name];
  // }
  // throw new Error("NotImplemented")
};

adapter.create = function (model, id, resource) {
  var _this = this;

  console.log("neo4j create", model, id, resource);
  throw new Error("NotImplemented")
};

adapter.update = function (model, id, update) {

  console.log("neo4j update", model, id, update);
  throw new Error("NotImplemented")
};

adapter.markDeleted = function(model, id){
  console.log("neo4j markDeleted", model, id);
  throw new Error("NotImplemented")
};

adapter.delete = function (model, id) {
  console.log("neo4j create", model, id);
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  return [];
  // throw new Error("NotImplemented")
}

adapter.count = function(model, query, projection) {
  console.log("neo4j count", model, query, projection);
  throw new Error("NotImplemented")
}

adapter.parseQuery = function(model, query){
  console.log("neo4j parseQuery", model, query, projection);
  throw new Error("NotImplemented")
};

adapter.awaitConnection = function () {
  var _this = this;
  console.log("neo4j awaitConnection");

  return new Promise(function (resolve, reject) {
    resolve();
  });
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

  throw new Error("NotImplemented")
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

  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
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
  throw new Error("NotImplemented")
};

module.exports = adapter;