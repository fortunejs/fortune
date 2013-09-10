var inflect = require('i')()
  , orm = require('orm')
  , RSVP = require('rsvp')
  , _ = require('lodash');

var adapter = {};

adapter._init = function(options) {
  var _this = this;

  // Setup ORM instance.
  this.orm = orm.connect({
    host: options.host,
    database: options.db,
    protocol: options.adapter,
    username: options.username,
    password: options.password,
    port: options.port,
    query: options.flags
  });

  // Setup db object after connection.
  this.orm.on('connect', function(error, db) {
    if(error) throw error;
    _this._db = db;
  });
};

adapter.schema = function(name, schema, options) {
  var _this = this;
  this._associations[name] = {};

  _.each(schema, function(value, key) {

    // Convert camel-cased key names to underscore
    var under = inflect.underscore(key);
    if(key != under) {
      schema[under] = schema[key];
      delete schema[key];
      key = under;
    }

    // Convert strings to associations
    var isArray = _.isArray(value);
    value = isArray ? value[0] : value;
    var isObject = _.isPlainObject(value);
    var ref = isObject ? value.ref : value;

    if(typeof ref == 'string') {
      var inverse = typeof value.inverse == 'string' ?
        inflect.underscore(value.inverse) : undefined;

      _this._associations[name][key] = {
        ref: inflect.underscore(ref),
        array: isArray,
        inverse: inverse
      };
      delete schema[key];
      return;
    }

    // Native type casting
    var type = isObject ? value.type : value;
    if(typeof type == 'function') {
      var ORMtype = typeCheck(type);

      if(ORMtype == 'string') ORMtype = 'text';
      if(ORMtype == 'buffer') ORMtype = 'binary';

      if(isObject) {
        schema[key].type = ORMtype;
      } else {
        schema[key] = value;
      }
    }

  });

  var model = this._db.define(name, schema, options);
  this._processAssociations();
  model.modelName = name;
  return model;

  function typeCheck(fn) {
    return Object.prototype.toString.call(new fn(''))
      .slice(1, -1).split(' ')[1].toLowerCase();
  }
};

/**
 * Stub method, since the model is defined in the
 * schema method.
 *
 * @param {String} name
 * @param {Object} [schema] this is actually the db model
 * @return {Object}
 */
adapter.model = function(name, schema) {
  if(schema) {
    return schema;
  } else {
    return !!this._db ? this._db.models[name] : null;
  }
};

/**
 * Wait for database to connect.
 *
 * @return {RSVP.Promise}
 */
adapter.awaitConnection = function() {
  var _this = this;
  return new RSVP.Promise(function(resolve, reject) {
    if(!_this._db) {
      _this.orm.on('connect', handleConnect);
    } else {
      resolve();
    }
    function handleConnect(error) {
      if(error) return reject(error);
      resolve();
    }
  });
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
  var instance = new model(resource);
  return new RSVP.Promise(function(resolve, reject) {
    _this._setToManyAssociations(
      model, instance, resource
    ).then(function(instance) {
      instance.save(handleSave);
    }, function(error) {
      reject(error);
    });
    function handleSave(error) {
      if(error) return reject(error);
      _this._setToOneAssociations(model, instance, resource);
      _this._getAssociations(model, instance).then(function(resource) {
        resolve(_this._deserialize(model, resource));
      }, reject);
    }
  });
};

adapter.update = function(model, id, update) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  update = this.serialize(model, update);
  return new RSVP.Promise(function(resolve, reject) {
    model.get(id, function(error, instance) {
      if(error) reject(error);
      _this._setToManyAssociations(
        model, instance, update
      ).then(function(instance) {
        instance.save(update, handleSave);
      }, function(error) {
        reject(error);
      });
      function handleSave(error) {
        if(error) return reject(error);
        _this._setToOneAssociations(model, instance, update);
        _this._getAssociations(model, instance).then(function(resource) {
          resolve(_this._deserialize(model, resource));
        }, reject);
      }
    });
  });
};

adapter.delete = function(model, id) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  return new RSVP.Promise(function(resolve, reject) {
    model.get(id, function(error, instance) {
      if(error) reject(error);
      var dissociated = _this._dissociate(model, instance);
      _this._setToManyAssociations(
        model, instance, dissociated
      ).then(function(instance) {
        instance.remove(function(error) {
          if(error) return reject(error);
          _this._setToOneAssociations(model, instance, dissociated);
          resolve();
        });
      }, reject);
    });
  });
};

adapter.find = function(model, query) {
  var _this = this;
  var method = typeof query != 'object' ? 'get' : 'find';
  model = typeof model == 'string' ? this._db.models[model] : model;

  return new RSVP.Promise(function(resolve, reject) {
    model[method](query, function(error, resource) {
      if(error) return reject(error);
      if(_.isArray(resource)) resource = resource[0];
      if(!resource) return reject();
      _this._getAssociations(model, resource).then(function(resource) {
        resolve(_this._deserialize(model, resource));
      }, reject);
    });
  });
};

adapter.findMany = function(model, query, limit) {
  var _this = this;
  model = typeof model == 'string' ? this._db.models[model] : model;
  limit = limit || 1000;

  if(_.isArray(query) && query.length) {
    query = query.map(function(id) {
      return new RSVP.Promise(function(resolve, reject) {
        model.get(id, function(error, resource) {
          if(error) return resolve(null); // not found
          _this._getAssociations(model, resource).then(function(resource) {
            resolve(resource);
          }, reject);
        });
      });
    });
    return RSVP.Promise(function(resolve, reject) {
      RSVP.all(query).then(function(resources) {
        resolve(_.map(_.compact(resources), function(resource) {
          return _this._deserialize(model, resource);
        }));
      }, reject);
    });
  } else if(_.isArray(query)) {
    query = {};
  }

  return new RSVP.Promise(function(resolve, reject) {
    model.find(query).limit(limit).run(function(error, resources) {
      if(error) return reject(error);
      var promises = resources.map(function(resource) {
        return _this._getAssociations(model, resource);
      });
      RSVP.all(promises).then(function(resources) {
        resolve(resources.map(function(resource) {
          return _this._deserialize(model, resource);
        }));
      }, reject);
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
  var _this = this;

  if(resource.hasOwnProperty('links') && typeof resource.links == 'object') {
    _.each(resource.links, function(value, key) {
      var suffix = _this._associations[model.modelName][key].array ? '_ids' : '_id';
      resource[key + suffix] = value;
    });
    delete resource.links;
  }

  // convert keys to underscore
  _.each(resource, function(value, key) {
    var under = inflect.underscore(key);
    if(under != key) {
      resource[under] = resource[key];
      delete resource[key];
    }
  });

  return resource;
};

/**
 * Return a resource ready to be sent back to client.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @return {Object}
 */
adapter._deserialize = function(model, resource) {
  var json = {};

  _.each(resource, function(value, key) {
    if(value === null || (_.isArray(value) && !value.length)) {
      return;
    } else {
      var ending = key.split('_').pop();
      if(key.split('_').length > 1 && (ending == 'id' || ending == 'ids')) {
        json.links = json.links || {};
        json.links[key.split('_').slice(0, -1).join('_')] = value;
      } else {
        json[key] = value;
      }
    }
  });

  return json;
};

/**
 * Store database object here.
 *
 * @api private
 */
adapter._db = null;

/**
 * Store associations per model.
 *
 * @api private
 */
adapter._associations = {};

/**
 * Process associations to be declared to the ORM.
 *
 * @api private
 */
adapter._processAssociations = function() {
  var _this = this;
  _.each(this._associations, function(associations, modelName) {
    _.each(associations, function(value, key) {
      if(!value.processed) {
        var model = _this._db.models[modelName]
          , relatedModel = _this._db.models[value.ref];

        if(model && relatedModel) {
          if(modelName == value.ref) {
            relatedModel = null;
          }
          if(value.array) {
            model.hasMany(key, relatedModel);
          } else {
            model.hasOne(key, relatedModel);
          }
          value.processed = true;
        }
      }
    });
    _this._db.models[modelName].sync(function(error) {
      if(error) throw error;
    });
  });
};

/**
 * Set to-many associations of a resource.
 *
 * @api private
 * @param {Object} model
 * @param {Object} instance
 * @param {Object} resource serialized JSON object
 * @return {RSVP.Promise}
 */
adapter._setToManyAssociations = function(model, instance, resource) {
  var _this = this
    , queue = [];

  /**
   * Many-to-many
   */
  var updateManyToMany = function(relatedModel, key) {
    var capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
    var relatedResources = (resource[key + '_ids'] || []).map(function(id) {
      return relatedModel(id);
    });
    if(relatedResources.length) {
      queue.push(new RSVP.Promise(function(resolve, reject) {
        instance['set' + capitalizedKey](relatedResources, function(error) {
          if(error) return reject(error);
          resolve();
        });
      }));
    }
  };

  // Dissociate a many collection from a related resource.
  var dissociate = function(relatedResource, manyKey) {
    manyKey = manyKey.charAt(0).toUpperCase() + manyKey.slice(1);
    return new RSVP.Promise(function(resolve, reject) {
      relatedResource['remove' + manyKey](instance, function(error) {
        if(error) return reject(error);
        resolve();
      });
    });
  };

  // Associate a many collection from a related resource.
  var associate = function(relatedResource, manyKey) {
    manyKey = manyKey.charAt(0).toUpperCase() + manyKey.slice(1);
    return new RSVP.Promise(function(resolve, reject) {
      relatedResource['has' + manyKey](instance, function(error, hasResource) {
        if(error) return reject(error);
        if(!hasResource) {
          relatedResource['add' + manyKey](instance, function(error) {
            if(error) return reject(error);
            resolve();
          });
        }
      });
    });
  };

  // One-to-many
  var updateOneToMany = function(relatedModel, key, manyKeys) {
    var capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
    queue.push(new RSVP.Promise(function(resolve, reject) {
      var updates = [];
      instance['get' + capitalizedKey](function(error, relatedResource) {
        if(error) throw error;
        if(relatedResource && relatedResource.id != resource[key + '_id']) {
          manyKeys.forEach(function(manyKey) {
            updates.push(dissociate(relatedResource, manyKey));
          });
        }
        if(!!resource[key + '_id']) {
          relatedResource = relatedModel(resource[key + '_id']);
          manyKeys.forEach(function(manyKey) {
            updates.push(associate(relatedResource, manyKey));
          });
        }
        RSVP.all(updates).then(resolve, reject);
      });
    }));
  };

  _.each(this._associations[model.modelName], function(value, key) {
    var relatedModel = _this._db.models[value.ref]
      , associations = _this._associations[value.ref]
      , manyKeys = [];

    if(typeof value.inverse == 'string') {
      associations = {};
      associations[value.inverse] = _this._associations[value.ref][value.inverse];
    }
    _.each(associations, function(relation, key) {
      if(relation.ref == model.modelName && relation.array) {
        manyKeys.push(key);
      }
    });

    if(value.array) {
      updateManyToMany(relatedModel, key, manyKeys);
    } else {
      updateOneToMany(relatedModel, key, manyKeys);
    }
  });

  return new RSVP.Promise(function(resolve, reject) {
    RSVP.all(queue).then(function() {
      resolve(instance);
    }, function(error) {
      reject(error);
    });
  });
};

/**
 * After setting to-many associations on a resource,
 * set to-one associations on related resources.
 *
 * @param {Object} model
 * @param {Object} instance
 * @param {Object} resource serialized JSON object
 */
adapter._setToOneAssociations = function(model, instance, resource) {
  var _this = this;

  _.each(this._associations[model.modelName], function(value, key) {
    var relatedModel = _this._db.models[value.ref]
      , associations = _this._associations[value.ref]
      , singularKeys = [];

    if(typeof value.inverse == 'string') {
      associations = {};
      associations[value.inverse] = _this._associations[value.ref][value.inverse];
    }
    _.each(associations, function(relation, key) {
      if(relation.ref == model.modelName && !relation.array) {
        singularKeys.push(key);
      }
    });

    var relatedResources = !!resource[key + '_id'] ?
      [relatedModel(resource[key + '_id'])] : [];

    /**
     * Dissociation and association of to-one relations
     */
    singularKeys.forEach(function(singularKey) {
      var query = {};
      query[singularKey + '_id'] = instance.id;
      relatedModel.find(query).run(function(error, resources) {
        if(error) return reject(error);
        _.union(relatedResources, resources).forEach(function(relatedResource) {
          if(_.contains(resource[key + '_ids'], relatedResource.id)) {
            relatedResource[singularKey + '_id'] = instance.id;
          } else {
            relatedResource[singularKey + '_id'] = null;
          }
          relatedResource.save();
        });
      });
    });
  });
};

/**
 * Append "many" associations from join tables.
 *
 * @api private
 * @param {Object} model
 * @param {Object} instance model instance
 * @return {RSVP.Promise}
 */
adapter._getAssociations = function(model, instance) {
  var promises = [];

  _.each(this._associations[model.modelName], function(value, key) {
    if(value.array) promises.push(new RSVP.Promise(function(resolve, reject) {
      var capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      instance['get' + capitalizedKey](function(error, resources) {
        if(error) return reject(error);
        instance[key + '_ids'] = resources.map(function(instance) {
          return instance.id;
        });
        resolve();
      });
    }));
  });

  return new RSVP.Promise(function(resolve, reject) {
    RSVP.all(promises).then(function() {
      resolve(instance);
    }, function(error) {
      reject(error);
    });
  });
};

/**
 * Remove associations from a resource.
 *
 * @api private
 * @param {Object} model
 * @param {Object} instance model instance
 * @return {Object}
 */
adapter._dissociate = function(model, instance) {
  _.each(this._associations[model.modelName], function(value, key) {
    if(value.array) {
      instance[key + '_ids'] = null;
    } else {
      instance[key + '_id'] = null;
    }
  });
  return instance;
};

module.exports = adapter;
