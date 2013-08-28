var inflect = require('i')()
  , mongoose = require('mongoose')
  , RSVP = require('rsvp')
  , _ = require('lodash');

var adapter = {};

/**
 * Initialization method.
 *
 * @api private
 * @param {Object} options
 */
adapter._init = function(options) {
  /**
   * Setup mongoose instance.
   */
  this.mongoose = mongoose.connect('mongodb://' +
    (options.username ? options.username + ':' + options.password + '@' : '') +
    options.host + (options.port ? ':' + options.port : '') + '/' + options.db,
    options.flags
  );
};

/**
 * Store models in an object here.
 *
 * @api private
 */
adapter._models = {};

adapter.schema = function(name, schema, options) {
  var ObjectId = mongoose.Schema.Types.ObjectId;
  var Mixed = mongoose.Schema.Types.Mixed;

  var typeCheck = function(fn) {
    return Object.prototype.toString.call(new fn())
      .slice(1, -1).split(' ')[1].toLowerCase();
  };

  _.each(schema, function(value, key) {

    // Convert strings to associations
    var isArray = _.isArray(value);
    value = isArray ? value[0] : value;
    var isObject = _.isPlainObject(value);
    var ref = isObject ? value.ref : value;
    if(typeof ref == 'string') {
      ref = inflect.underscore(ref);
      var inverse = isObject ? inflect.underscore(value.inverse || '') : undefined;
      if(isObject) {
        var field = isArray ? schema[key][0] : schema[key];
        field.ref = ref;
        field.type = ObjectId;
        field.inverse = inverse;
      } else {
        var obj = {type: ObjectId, ref: ref, inverse: inverse};
        schema[key] = isArray ? [obj] : obj;
      }
    }

    // Convert native object to schema type Mixed
    if(typeof value == 'function' && typeCheck(value) == 'object') {
      if(isObject) {
        schema[key].type = Mixed;
      } else {
        schema[key] = Mixed;
      }
    }

    // Convert camel-cased key names to underscore
    var under = inflect.underscore(key);
    if(key != under) {
      schema[under] = schema[key];
      delete schema[key];
    }

  });

  return mongoose.Schema(schema, options);
};

adapter.model = function(name, schema) {
  if(schema) {
    var model = this.mongoose.model.apply(this.mongoose, arguments);
    this._models[name] = model;
    return model;
  } else {
    return this._models[name];
  }
};

adapter.create = function(model, id, resource) {
  var _this = this;
  if(!resource) {
    resource = id;
  } else {
    resource.id = id;
  }
  model = typeof model == 'string' ? this.model(model) : model;
  resource = this._serialize(model, resource);
  return new RSVP.Promise(function(resolve, reject) {
    model.create(resource,
      function(error, resource) {
        _this._handleWrite(
          model, resource, error, resolve, reject
        );
      }
    );
  });
};

adapter.update = function(model, id, update) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  update = this._serialize(model, update);
  return new RSVP.Promise(function(resolve, reject) {
    model.findByIdAndUpdate(id, update,
      function(error, resource) {
        _this._handleWrite(
          model, resource, error, resolve, reject
        );
      }
    );
  });
};

adapter.delete = function(model, id) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  return new RSVP.Promise(function(resolve, reject) {
    model.findByIdAndRemove(id, function(error, resource) {
      resource = _this._dissociate(model, resource);
      _this._handleWrite(
        model, resource, error, resolve, reject
      );
    });
  });
};

adapter.find = function(model, query) {
  var _this = this
    , method = typeof query != 'object' ? 'findById' : 'findOne';

  model = typeof model == 'string' ? this._models[model] : model;
  return new RSVP.Promise(function(resolve, reject) {
    model[method](query, function(error, resource) {
      if(error || !resource) {
        return reject(error);
      }
      resolve(_this._deserialize(model, resource));
    });
  });
};

adapter.findMany = function(model, query, limit) {
  var _this = this;
  if(_.isArray(query)) {
    query = query.length ? {_id: {$in: query}} : {};
  }
  model = typeof model == 'string' ? this._models[model] : model;
  limit = limit || 1000;

  return new RSVP.Promise(function(resolve, reject) {
    model.find(query).limit(limit).exec(function(error, resources) {
      if(error) {
        return reject(error);
      }
      resources = resources.map(function(resource) {
        return _this._deserialize(model, resource);
      });
      resolve(resources);
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
adapter._serialize = function(model, resource) {
  if(resource.hasOwnProperty('id')) {
    resource._id = mongoose.Types.ObjectId(resource.id.toString());
    delete resource.id;
  }
  if(resource.hasOwnProperty('links') && typeof resource.links == 'object') {
    _.each(resource.links, function(value, key) {
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
adapter._deserialize = function(model, resource) {
  resource = resource.toObject();

  resource.id = resource._id;
  delete resource.__v;
  delete resource._id;

  var relations = [];
  model.schema.eachPath(function(path, type) {
    var instance = type.instance ||
      (type.caster ? type.caster.instance : undefined);
    if(path != '_id' && instance == 'ObjectID') {
      relations.push(path);
    }
  });
  if(relations.length) {
    var links = {};
    _.each(relations, function(relation) {
      if(_.isArray(resource[relation]) ?
        resource[relation].length :
        resource[relation]
      ) {
        links[relation] = resource[relation];
      }
      delete resource[relation];
    });
    if(_.keys(links).length) {
      resource.links = links;
    }
  }
  return resource;
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
adapter._handleWrite = function(model, resource, error, resolve, reject) {
  var _this = this;
  if(error) {
    return reject(error);
  }
  this._updateRelationships(model, resource).then(function(resource) {
    resolve(_this._deserialize(model, resource));
  }, function() {
    reject();
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
adapter._updateRelationships = function(model, resource) {
  var _this = this;

  /**
   * Get fields that contain references.
   */
  var references = [];
  _.each(model.schema.tree, function(value, key) {
    var singular = !_.isArray(value)
      , obj = singular ? value : value[0];
    if(typeof obj == 'object' && obj.hasOwnProperty('ref')) {
      references.push({
        path: key,
        model: obj.ref,
        singular: singular,
        inverse: obj.inverse
      });
    }
  });

  var promises = [];
  _.each(references, function(reference) {
    var relatedModel = _this._models[reference.model]
      , relatedTree = relatedModel.schema.tree
      , fields = [];

    // Get fields on the related model that reference this model
    if(typeof reference.inverse == 'string') {
      var inverted = {};
      inverted[reference.inverse] = relatedTree[reference.inverse];
      relatedTree = inverted;
    }
    _.each(relatedTree, function(value, key) {
      var singular = !_.isArray(value)
        , obj = singular ? value : value[0];
      if(typeof obj == 'object' && obj.ref == model.modelName) {
        fields.push({
          path: key,
          model: relatedModel,
          singular: singular,
          inverse: obj.inverse
        });
      }
    });

    // Iterate over each relation
    _.each(fields, function(field) {
      // One-to-one
      if(reference.singular && field.singular) {
        promises.push(_this._updateOneToOne(
          relatedModel, resource, reference, field
        ));
      }
      // One-to-many
      if(reference.singular && !field.singular) {
        promises.push(_this._updateOneToMany(
          relatedModel, resource, reference, field
        ));
      }
      // Many-to-one
      if(!reference.singular && field.singular) {
        promises.push(_this._updateManyToOne(
          relatedModel, resource, reference, field
        ));
      }
      // Many-to-many
      if(!reference.singular && !field.singular) {
        promises.push(_this._updateManyToMany(
          relatedModel, resource, reference, field
        ));
      }
    });
  });

  return new RSVP.Promise(function(resolve, reject) {
    RSVP.all(promises).then(
      function() {
        resolve(resource);
      }, function() {
        reject();
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
adapter._updateOneToOne = function(relatedModel, resource, reference, field) {
  return new RSVP.Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = 1;
    relatedModel.where(field.path, resource.id).update(dissociate, function(error) {
      if(error) return reject();
      
      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource.id;
      relatedModel.findByIdAndUpdate(
        resource[reference.path],
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
adapter._updateOneToMany = function(relatedModel, resource, reference, field) {
  return new RSVP.Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource.id;
    relatedModel.where(field.path, resource.id).update(dissociate, function(error) {
      if(error) return reject();

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource.id;
      relatedModel.findByIdAndUpdate(
        resource[reference.path],
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
adapter._updateManyToOne = function(relatedModel, resource, reference, field) {
  return new RSVP.Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = 1;

    relatedModel.where(field.path, resource.id).update(dissociate, function(error) {
      if(error) return reject();

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource.id;
      relatedModel.where('id', resource[reference.path] || {})
        .update(associate, function(error) {
          if(error) return reject();
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
adapter._updateManyToMany = function(relatedModel, resource, reference, field) {
  return new RSVP.Promise(function(resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource.id;

    relatedModel.where(field.path, resource.id).update(dissociate, function(error) {
      if(error)  return reject();

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource.id;

      relatedModel.where('id', resource[reference.path] || {})
        .update(associate, function(error) {
          if(error) return reject();
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
adapter._dissociate = function(model, resource) {
  model.schema.eachPath(function(path, type) {
    var instance = type.instance ||
      (type.caster ? type.caster.instance : undefined);
    if(path != '_id' && instance == 'ObjectID') {
      resource[path] = null;
    }
  });
  return resource;
};

module.exports = adapter;
