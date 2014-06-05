var mongoose = require('mongoose');
var RSVP = require('rsvp');
var _ = require('lodash');
var moment = require("moment");
var Promise = RSVP.Promise;
var adapter = {};

adapter._init = function (options) {
  var connectionString = options.connectionString;

  if (!connectionString.length) {
    connectionString = 'mongodb://' +
      (options.username ? options.username + ':' + options.password + '@' : '') +
      options.host + (options.port ? ':' + options.port : '') + '/' + options.db;
  }

  //Setup mongoose instance
  this.db = mongoose.createConnection(connectionString, options.flags);
};

/**
 * Store models in an object here.
 *
 * @api private
 */
adapter._models = {};

adapter.schema = function (name, schema, options, schemaCallback) {
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
      var field = {
        ref: ref,
        inverse: inverse,
        type: pkType,
        external: !!value.external
      };

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

  if(pk) schema[pk] = { type: schema[pk], index: {unique: true}};

  schema = mongoose.Schema(schema, options);
  schema.refkeys = refkeys;

  _.each(refkeys, function(key){
    var index = {};
    index[key] = 1;
    
    schema.index(index);
  });

  if (schemaCallback)
    schemaCallback(schema);
  
  return schema;

  function typeCheck(fn) {
    return Object.prototype.toString.call(new fn(''))
      .slice(1, -1).split(' ')[1].toLowerCase();
  }
};

adapter.model = function(name, schema, options) {
  if(schema) {
    var model = this.db.model(name, schema);
    this._models[name] = model;
    return _.extend(model, options);
  } else {
    return this._models[name];
  }
};

adapter.create = function (model, id, resource) {
  var _this = this;
  if (!resource) {

    resource = id;
  } else {
    resource.id = id;
  }
  model = typeof model == 'string' ? this.model(model) : model;
  resource = this._serialize(model, resource);
  return new Promise(function (resolve, reject) {
    model.create(resource, function (error, resource) {
      _this._handleWrite(model, resource, error, resolve, reject);
    });
  });
};

adapter.update = function (model, id, update) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  update = this._serialize(model, update);
  var pk = model.pk || "_id";
  
  return new Promise(function(resolve, reject) {
    var match = {};
    match[pk] = id;
    
    model.findOneAndUpdate(match, update, function(error, resource) {
      _this._handleWrite(model, resource, error, resolve, reject);
    });
  });
};

adapter.delete = function (model, id) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  var pk = model.pk || "_id";
  
  return new Promise(function(resolve, reject) {
    var match = {};
    if(id) match[pk] = id;
    
    model.find(match).exec(function(error,resources){
      model.remove(match, function(error){
        if(error){
          reject(error);
        } else {
          resolve(resources);
        }
      });
    });
  }).then(function(resources){
    return RSVP.all(_.map(resources, function(resource){
      return new Promise(function(resolve,reject){
        _this._dissociate(model, resource);
        _this._handleWrite(model, resource, null, resolve, reject);
      });
    }));
  });
};

/**
 *
 * @param model {Model}
 * @param query {Object}
 * @param projection {Object}
 * @returns {Promise}
 */
adapter.find = function(model, query, projection) {
  var _this = this,
      dbQuery = {};

  model = typeof model == 'string' ? this._models[model] : model;

  var pk = model.pk || "_id";

  if(_.isObject(query)){
    dbQuery = _.clone(query);
    if(query.id){
      dbQuery[pk] = query.id;
      delete dbQuery.id;
    }
  }else{
    dbQuery[pk] = query;
  }

  projection = projection || {};
  projection.select = projection.select || '';

  var pkNotRequested = false;
  if (_.isArray(projection.select)){
    if (model.pk){
      if (projection.select.indexOf(model.pk) === -1){
        projection.select.push(model.pk);
        pkNotRequested = true;
      }
    }
    projection.select = projection.select.join(' ');
  }

  return new Promise(function(resolve, reject) {
    model.findOne(dbQuery).select(projection.select).exec(function(error, resource) {
      if(error || !resource) {
        return reject(error);
      }
      var doc = _this._deserialize(model, resource);
      if (pkNotRequested){
        delete doc[model.pk];
      }
      return resolve(doc);
    });
  });
};

/**
 *
 * @param model {Model || String}
 * @param query {Object}
 * //@param limit {Number} - deprecated as unused
 * @param projection {Object}
 * @returns {Promise}
 */
adapter.findMany = function(model, query, projection) {
  var _this = this,
      dbQuery = {};

  model = typeof model == 'string' ? this._models[model] : model;

  var pk = model.pk || "_id";

  _.each(query, function(val, key){
    var m;
    if(model.schema.tree[key] === Date && _.isString(val)){
      m = moment(val);
      
      if(m.format("YYYY-MM-DD") === val){
        query[key] = {
          $gte: val,
          $lte: moment(val).add("days", 1).format("YYYY-MM-DD")
        };
      }
    } 
  });

  if(_.isObject(query)){
    if(_.isArray(query)) {
      if(query.length) dbQuery[pk] = {$in: query};
    }else{
      dbQuery = _.clone(query);

      if(query.id){
        dbQuery[pk] = query.id;
        delete dbQuery.id;
      }
    }
  }else if(typeof query === 'number' && arguments.length === 2){
    //Just for possible backward compatibility issues
    projection = projection || {};
    projection.limit = projection.limit = query;
  }

  projection = projection || {};
  projection.limit = projection.limit || 1000;
  projection.select = projection.select || '';

  //Ensure business id is included to selection
  var pkNotRequested = false;
  if (_.isArray(projection.select)){
    if (model.pk){
      if (projection.select.indexOf(model.pk) === -1){
        projection.select.push(model.pk);
        pkNotRequested = true;
      }
    }
    projection.select = projection.select.join(' ');
  }

  return new Promise(function(resolve, reject) {
    model.find(dbQuery)
      .limit(projection.limit)
      .select(projection.select)
      .exec(function(error, resources) {
        if(error) {
          return reject(error);
        }

        resources = resources.map(function (resource) {
          var temp = _this._deserialize(model, resource);
          if (pkNotRequested){
            //Remove business pk field if it's not required
            delete temp[model.pk];
          }
          return temp;
        });
      resolve(resources);
    });
  });
};

adapter.awaitConnection = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    _this.db.once('connected', function () {
      resolve();
    });
    _this.db.once('error', function (error) {
      reject(error);
    });
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
  if (resource.hasOwnProperty('id')) {
    //TODO: This may cause WEB-2618 issue. Test for /[0-9a-f]{24}/ before casting
    resource._id = mongoose.Types.ObjectId(resource.id.toString());

    delete resource.id;
  }
  if (resource.hasOwnProperty('links') && typeof resource.links == 'object') {
    _.each(resource.links, function (value, key) {
      resource[key] = value;
    });
    delete resource.links;
  }

  return resource;
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
  //TODO: Add lean(true) to find methods to increase performance
  resource = resource.toObject();

  json.id = resource[model.pk || "_id"];

  _.extend(json, _.omit(resource, "_id", "__v"));
  
  var relations = model.schema.refkeys;

  if(relations.length) {
    var links = {};

    _.each(relations, function(relation) {
      if(_.isArray(json[relation]) ? json[relation].length : json[relation]) {
        links[relation] = json[relation];
      }
      delete json[relation];
    });
    if (_.keys(links).length) {
      json.links = links;
    }
  }

  return json;
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
 */
adapter._handleWrite = function (model, resource, error, resolve, reject) {
  var _this = this;
  if (error) {
    return reject(error);
  }
  this._updateRelationships(model, resource).then(function(resource) {
    resolve(_this._deserialize(model, resource));
  }, function (error) {
    reject(error);
  });
};

/**
 * Update relationships manually. By nature of NoSQL,
 * relations don't come for free. Don't try this at home, kids.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @return {Promise}
 */
adapter._updateRelationships = function (model, resource) {
  var _this = this;

  /**
   * Get fields that contain references.
   */
  var references = [];
  _.each(model.schema.tree, function (value, key) {
    var singular = !_.isArray(value);
    var obj = singular ? value : value[0];
    if (typeof obj == 'object' && obj.hasOwnProperty('ref')) {
      references.push({
        path: key,
        model: obj.ref,
        singular: singular,
        inverse: obj.inverse,
        isExternal: obj.external
      });
    }
  });

  var promises = [];
  _.each(references, function(reference) { 
    var relatedModel = _this._models[reference.model],
        fields = [];

    if(!reference.isExternal){
      var relatedTree = relatedModel.schema.tree;

      // Get fields on the related model that reference this model
      if(typeof reference.inverse == 'string') {
        var inverted = {};
        inverted[reference.inverse] = relatedTree[reference.inverse];
        relatedTree = inverted;
      }
      _.each(relatedTree, function(value, key) {
        var singular = !_.isArray(value);
        var obj = singular ? value : value[0];

        if(typeof obj == 'object' && obj.ref == model.modelName) {
          fields.push({
            path: key,
            model: obj.ref,
            singular: singular,
            inverse: obj.inverse
          });
        }
      });
    }
    
    // Iterate over each relation
    _.each(fields, function (field) {
      // One-to-one
      if (reference.singular && field.singular) {
        promises.push(_this._updateOneToOne(
          model, relatedModel, resource, reference, field
        ));
      }
      // One-to-many
      if (reference.singular && !field.singular) {
        promises.push(_this._updateOneToMany(
          model, relatedModel, resource, reference, field
        ));
      }
      // Many-to-one
      if (!reference.singular && field.singular) {
        promises.push(_this._updateManyToOne(
          model, relatedModel, resource, reference, field
        ));
      }
      // Many-to-many
      if (!reference.singular && !field.singular) {
        promises.push(_this._updateManyToMany(
          model, relatedModel, resource, reference, field
        ));
      }
    });
  });

  return new Promise(function (resolve, reject) {
    RSVP.all(promises).then(
      function () {
        resolve(resource);
      }, function (errors) {
        reject(errors);
      }
    );
  });
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
  return new Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    var pk = model.pk || "_id";
    var match = {};
    match[field.path] = resource[pk];

    dissociate.$unset[field.path] = resource[pk];
    //relatedModel.where(field.path, resource[pk]).update(dissociate, function(error) {

    relatedModel.update(match, dissociate, function(error) {
      //console.log("1-1", error);
      if(error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource[model.pk || "_id"];

      var match = {};
      match[relatedModel.pk || "_id"] = resource[reference.path];

      relatedModel.findOneAndUpdate(
        match,
        associate,
        resolve
      );
    });
  });
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
  return new Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}},
        pk = model.pk || "_id",
        match = {};
    match[field.path] = resource[pk];

    dissociate.$pull[field.path] = resource[pk];
    
    relatedModel.update(match, dissociate, function(error) {
      //console.log("1-m",error);
      
      if(error) return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource[model.pk || "_id"];

      var match = {};
      match[relatedModel.pk || "_id"] = resource[reference.path];

      relatedModel.findOneAndUpdate(
        match,
        associate,
        resolve
      );
    });
  });
};

/**
 * Update many-to-one mapping.
 *
 * @api private
 * @parameter {Object} relatedModel
 * @parameter {Object} resource
 * @parameter {Object} reference
 * @parameter {Object} field
 * @return {Promise}
 */
adapter._updateManyToOne = function(model, relatedModel, resource, reference, field) {
  return new Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}},
        pk = model.pk || "_id",
        match = {};
    match[field.path] = resource[pk];

    dissociate.$unset[field.path] = 1;

    relatedModel.update(match, dissociate, function(error) {
      if(error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource[model.pk || "_id"];


      var match = {};
      match[relatedModel.pk || "_id"] = {$in: resource[reference.path] || []};

      relatedModel.update(match, associate, {multi: true}, function(error) {
        if(error) return reject(error);
        resolve();
      });
    });
  });
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
  return new Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}},
        pk = model.pk || "_id",
        match = {};
    match[field.path] = resource[pk];

    dissociate.$pull[field.path] = resource[pk];

    relatedModel.update(match, dissociate, {multi: true}, function(error) {
      if(error)  return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource[model.pk || "_id"];

      //var ids = {_id: {$in: resource[reference.path] || []}};

      var match = {};
      match[relatedModel.pk || "_id"] = {$in: resource[reference.path] || []};
      
      return relatedModel.update(match, associate, {multi: true}, function(error) {
        if(error) return reject(error);
        return resolve();
      });
    });
  });
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
  model.schema.eachPath(function (path, type) {
    var instance = type.instance || (type.caster ? type.caster.instance : undefined);

    if (path != '_id' && instance == 'ObjectID') {
      resource[path] = null;
    }
  });
  return resource;
};

// expose mongoose
adapter.mongoose = mongoose;

module.exports = adapter;
