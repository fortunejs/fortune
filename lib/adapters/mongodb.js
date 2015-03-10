var mongoose = require('mongoose');
var RSVP = require('rsvp');
var _ = require('lodash');

var Promise = RSVP.Promise;
var adapter = {};

adapter._init = function (options) {
  var connectionString = options.connectionString || '';

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

adapter.schema = function (name, schema, options) {
  var ObjectId = mongoose.Schema.Types.ObjectId;
  var Mixed = mongoose.Schema.Types.Mixed;

  _.each(schema, function (val, key) {
    var obj = {};
    var isArray = _.isArray(val);
    var value = isArray ? val[0] : val;
    var isObject = _.isPlainObject(value);
    var ref = isObject ? value.ref : value;
    var inverse = isObject ? value.inverse : undefined;

    // Convert strings to associations
    if (typeof ref == 'string') {
      obj.ref = ref;
      obj.inverse = inverse;
      obj.type = ObjectId;
      schema[key] = isArray ? [obj] : obj;
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

  return mongoose.Schema(schema, options);

  function typeCheck(fn) {
    return Object.prototype.toString.call(new fn(''))
      .slice(1, -1).split(' ')[1].toLowerCase();
  }
};

adapter.model = function (name, schema) {
  if (schema) {
    var model = this.db.model.apply(this.db, arguments);
    this._models[name] = model;
    return model;
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

adapter.update = function (model, id, update ,options) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  update = this._serialize(model, update);

  return new Promise(function (resolve, reject) {
    var cb = function (error, resource) {
      if (error) {
        return reject(error);
      }
      _this._handleWrite(model, resource, error, resolve, reject);
    };

    if(options){
      model.findByIdAndUpdate(id, update, options, cb);
    }else{
      model.findByIdAndUpdate(id, update, cb);
    }
  });
};

//nb: query cannot be a string in this case.
adapter.upsert = function (model, query, update) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  update = this._serialize(model, update);

  return new Promise(function (resolve, reject) {
    var cb = function (error, resource) {
      if (error) {
        return reject(error);
      }
      _this._handleWrite(model, resource, error, resolve, reject);
    };

     model.findOneAndUpdate(query, update, {update:true}, cb);
  });
}

adapter.delete = function (model, id) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  return new Promise(function (resolve, reject) {
    model.findByIdAndRemove(id, function (error, resource) {
      resource = _this._dissociate(model, resource);
      _this._handleWrite(model, resource, error, resolve, reject);
    });
  });
};

adapter.find = function (model, query) {
  var _this = this;
  var method = typeof query != 'object' ? 'findById' : 'findOne';

  model = typeof model == 'string' ? this._models[model] : model;
  return new Promise(function (resolve, reject) {
    model[method](query, function (error, resource) {
      if (error) {
        return reject(error);
      }
      resolve(_this._deserialize(model, resource));
    });
  });
};

adapter.findMany = function (model, query, limit, skip, sort, fields) {
  var _this = this;

  if(_.isObject(query)){
      query.id && (query._id = query.id) && delete query.id;
  }
  query && query._id && _.isArray(query._id) && (query._id = { $in:query._id });

  if (_.isArray(query)) {
    query = query.length ? {_id: {$in: query}} : {};
  } else if (!query) {
    query = {};
  } else if (typeof query == 'number') {
    limit = query;
  }

  model = typeof model == 'string' ? this._models[model] : model;
  limit = limit || 1000;
  skip = skip ? skip : 0;
  sort = sort || {"_id":-1};
  var arr = fields?fields.split(" "):[];
    _.each(arr,function(field,index){
        arr[index]=field.replace("links.","");
    })
  fields && (fields = arr.join(" "))
  return new Promise(function (resolve, reject) {
    model.find(query).skip(skip).sort(sort).limit(limit).select(fields).exec(function (error, resources) {
      if (error) {
        return reject(error);
      }
      resources = resources.map(function (resource) {
        return _this._deserialize(model, resource);
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
    // check whether db isn't already in connected state   
    // if so it wil not emit the connected event and therefore can keep the promise dangling   
    if (_this.db._readyState==1) {   
      resolve();   
    }    
   
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
  if(!resource){
    return undefined;
  }
  if (resource.toObject) {
    resource = resource.toObject();
  }

  json.id = resource._id;

  var relations = [];
  model.schema.eachPath(function (path, type) {
    if (path == '_id' || path == '__v') return;
    json[path] = resource[path];
    var instance = type.instance ||
      (type.caster ? type.caster.instance : undefined);
    if (path != '_id' && instance == 'ObjectID') {
      relations.push(path);
    }
  });
  if (relations.length) {
    var links = {};
    _.each(relations, function (relation) {
      if (_.isArray(json[relation]) ? json[relation].length : json[relation]) {
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
  this._updateRelationships(model, resource).then(function (resource) {
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
        inverse: obj.inverse
      });
    }
  });

  var promises = [];
  _.each(references, function (reference) {
    var relatedModel = _this._models[reference.model];
    var relatedTree = relatedModel.schema.tree;
    var fields = [];

    // Get fields on the related model that reference this model
    if (typeof reference.inverse == 'string') {
      var inverted = {};
      inverted[reference.inverse] = relatedTree[reference.inverse];
      relatedTree = inverted;
    }
    _.each(relatedTree, function (value, key) {
      var singular = !_.isArray(value);
      var obj = singular ? value : value[0];
      if (typeof obj == 'object' && obj.ref == model.modelName) {
        fields.push({
          path: key,
          model: obj.ref,
          singular: singular,
          inverse: obj.inverse
        });
      }
    });

    // Iterate over each relation
    _.each(fields, function (field) {
      // One-to-one
      if (reference.singular && field.singular) {
        promises.push(_this._updateOneToOne(
          relatedModel, resource, reference, field
        ));
      }
      // One-to-many
      if (reference.singular && !field.singular) {
        promises.push(_this._updateOneToMany(
          relatedModel, resource, reference, field
        ));
      }
      // Many-to-one
      if (!reference.singular && field.singular) {
        promises.push(_this._updateManyToOne(
          relatedModel, resource, reference, field
        ));
      }
      // Many-to-many
      if (!reference.singular && !field.singular) {
        promises.push(_this._updateManyToMany(
          relatedModel, resource, reference, field
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
adapter._updateOneToOne = function (relatedModel, resource, reference, field) {
  return new Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = 1;
    relatedModel.where(field.path, resource.id).update(dissociate, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource.id;

      if (!resource[reference.path]) return resolve();
      relatedModel.findByIdAndUpdate(resource[reference.path], associate, function (error) {
        if (error) return reject(error);
        resolve();
      });
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
adapter._updateOneToMany = function (relatedModel, resource, reference, field) {
  return new Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource.id;
    relatedModel.where(field.path, resource.id).update(dissociate, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource.id;

      if (!resource[reference.path]) return resolve();
      relatedModel.findByIdAndUpdate(resource[reference.path], associate, function (error) {
        if (error) return reject(error);
        resolve();
      });
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
adapter._updateManyToOne = function (relatedModel, resource, reference, field) {
  return new Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = 1;

    relatedModel.where(field.path, resource.id).update(dissociate, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource.id;
      var ids = {_id: {$in: resource[reference.path] || []}};

      relatedModel.update(ids, associate, {multi: true}, function (error) {
        if (error) return reject(error);
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
adapter._updateManyToMany = function (relatedModel, resource, reference, field) {
  return new Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource.id;

    relatedModel.where(field.path, resource.id).update(dissociate, function (error) {
      if (error)  return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource.id;
      var ids = {_id: {$in: resource[reference.path] || []}};

      relatedModel.update(ids, associate, {multi: true}, function (error) {
        if (error) return reject(error);
        resolve();
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
    var instance = type.instance ||
      (type.caster ? type.caster.instance : undefined);
    if (path != '_id' && instance == 'ObjectID') {
      resource[path] = null;
    }
  });
  return resource;
};

// expose mongoose
adapter.mongoose = mongoose;

module.exports = adapter;
