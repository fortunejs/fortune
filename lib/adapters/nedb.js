var fs = require('fs');
var path = require('path');

var mkdirp = require('mkdirp');
var NeDB = require('nedb');
var RSVP = require('rsvp');
var _ = require('lodash');

var adapter = {};

adapter._init = function (options) {
  // Store options
  this._options = options;
};

adapter.schema = function (name, schema, options) {
  options = options || {};

  _.each(schema, function (value, key) {
    var obj = {};
    var isArray = _.isArray(value);
    value = isArray ? value[0] : value;
    var isObject = _.isPlainObject(value);
    var ref = isObject ? value.ref : value;
    var inverse = isObject ? value.inverse : undefined;

    // Convert string to association object
    if (typeof ref === 'string') {
      obj.ref = ref;
      obj.inverse = inverse;
      schema[key] = isArray ? [obj] : obj;
    }

    // Wrap native type in object
    if (typeof value === 'function') {
      schema[key] = isArray ? [{type: schema[key]}] : {type: schema[key]};
    }

  });
  this._schemas[name] = schema;
  return schema;
};

adapter.model = function (name, schema) {
  if (schema) {
    var dbPath = path.join(this._options.path, this._options.db);
    var filePath = path.join(dbPath, name);
    var options = {
      filename: filePath,
      autoload: true
    };
    options = _.extend(options, this._options.flags);

    if (!options.inMemoryOnly) {
      mkdirp.sync(dbPath);
      fs.exists(filePath, function (exists) {
        if (!exists) {
            fs.writeFileSync(filePath, '');
        }
      });
    }

    // Actually set up a database
    var db = new NeDB(options);

    // Store the model name in a private key
    db._name = name;

    this._models[name] = db;
    return db;
  } else {
    return this._models[name];
  }
};

adapter.create = function (model, id, resource) {
  var _this = this;

  if (!resource) {
    resource = id;
  } else {
    /*!
     * Can't set id on a resource :(
     * This leads to unexpected behavior when trying to PUT a new resource.
     */
  }

  model = typeof model === 'string' ? this.model(model) : model;
  resource = this._serialize(model, resource);
  return new RSVP.Promise(function (resolve, reject) {
    model.insert(resource, function (error, resource) {
      _this._handleWrite(model, resource, error, resolve, reject);
    });
  });
};

adapter.update = function (model, id, update) {
  var _this = this;
  model = typeof model === 'string' ? this.model(model) : model;
  update = {$set: this._serialize(model, update)};
  return new RSVP.Promise(function (resolve, reject) {
    var find = {_id: id};
    model.update(find, update, function (error) {
      if (error) return reject(error);
      model.findOne(find, function (error, resource) {
        _this._handleWrite(model, resource, error, resolve, reject);
      });
    });
  });
};

adapter.delete = function (model, id) {
  var _this = this;
  model = typeof model === 'string' ? this.model(model) : model;
  return new RSVP.Promise(function (resolve, reject) {
    var find = {_id: id};
    model.findOne(find, function (error, resource) {
      if (error || !resource) return reject(error);
      resource = _this._dissociate(model, resource);
      model.remove(find, function (error) {
        _this._handleWrite(model, resource, error, resolve, reject);
      });
    });
  });
};

adapter.find = function (model, query) {
  var _this = this;

  query = typeof query === 'object' ? query : {_id: query};
  model = typeof model === 'string' ? this.model(model) : model;

  return new RSVP.Promise(function (resolve, reject) {
    model.findOne(query, function (error, resource) {
      if (error || !resource) return reject(error);
      resolve(_this._deserialize(model, resource));
    });
  });
};

adapter.findMany = function (model, query, limit) {
  var _this = this;
  if (_.isArray(query)) {
    query = query.length ? {_id: {$in: query}} : {};
  } else if (!query) {
    query = {};
  } else if (typeof query == 'number') {
    limit = query;
  }
  model = typeof model === 'string' ? this.model(model) : model;
  limit = limit || 1000;

  return new RSVP.Promise(function (resolve, reject) {
    model.find(query, function (error, resources) {
      if (error) return reject(error);
      resources = resources.map(function (resource) {
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
adapter._serialize = function (model, resource) {

  // setting ID is not allowed
  if (resource.hasOwnProperty('id')) {
    delete resource.id;
  }
  if (resource.hasOwnProperty('_id')) {
    delete resource._id;
  }

  // flatten links
  if (resource.hasOwnProperty('links') && typeof resource.links === 'object') {
    _.each(resource.links, function (value, key) {
      resource[key] = value;
    });
    delete resource.links;
  }

  return this._scrubResource(model, resource);

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

  json.id = resource._id;

  var relations = [];
  _.each(this._schemas[model._name], function (value, key) {
    if (key === '_id') return;
    json[key] = resource[key];
    if (_.isArray(value) ? value[0].ref : value.ref) {
      relations.push(key);
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
 * Type-cast key values according to the schema.
 *
 * @api private
 * @param {Object} model
 * @param {Object} resource
 * @return {Object}
 */
adapter._scrubResource = function (model, resource) {
  var json = {};
  var schema = this._schemas[model._name];

  _.each(schema, function (value, key) {
    var type = value.type;
    var typeString = type ? typeCheck(type) : '';
    var ref = _.isArray(value) ? value[0].ref : value.ref;

    if (!resource.hasOwnProperty(key)) return;

    if (type && !ref) {
      json[key] = type(resource[key]);
      if (typeString === 'date') {
        json[key] = new Date(resource[key]);
      } else if (typeString === 'array' || typeString === 'object') {
        json[key] = typeof resource[key] === 'object' ? resource[key] : null;
      }
    } else if (ref) {
      json[key] = resource[key];
    }
  });

  return json;

  function typeCheck (fn) {
    return Object.prototype.toString.call(new fn(''))
      .slice(1, -1).split(' ')[1].toLowerCase();
  }
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
  if (error || !resource) return reject(error);

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

  // Get fields that contain references
  var references = [];
  _.each(this._schemas[model._name], function (value, key) {
    var singular = !_.isArray(value);
    var obj = singular ? value : value[0];

    if (typeof obj === 'object' && obj.hasOwnProperty('ref')) {
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
    var relatedSchema = _this._schemas[reference.model];
    var fields = [];

    // Get fields on the related model that reference this model
    if (typeof reference.inverse === 'string') {
      var inverted = {};

      inverted[reference.inverse] = relatedSchema[reference.inverse];
      relatedSchema = inverted;
    } else if (reference.inverse !== undefined && !reference.inverse) {
      return;
    }
    _.each(relatedSchema, function (value, key) {
      var singular = !_.isArray(value);
      var obj = singular ? value : value[0];

      if (typeof obj === 'object' && obj.ref === model._name) {
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

  return new RSVP.Promise(function (resolve, reject) {
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
  var options = {multi: true};

  return new RSVP.Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = true;
    var find = {};
    find[field.path] = resource._id;

    relatedModel.update(find, dissociate, options, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource._id;
      var find = {_id: resource[reference.path]};

      relatedModel.update(find, associate, options, function (error) {
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
  var options = {multi: true};

  return new RSVP.Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource._id;
    var find = {};
    find[field.path] = resource._id;

    relatedModel.update(find, dissociate, options, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource._id;
      var find = {_id: resource[reference.path]};
      relatedModel.update(find, associate, options, function (error) {
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
  var options = {multi: true};

  return new RSVP.Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$unset: {}};
    dissociate.$unset[field.path] = true;
    var find = {};
    find[field.path] = resource._id;

    relatedModel.update(find, dissociate, options, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource._id;
      var find = {_id: {$in: resource[reference.path] || []}};

      relatedModel.update(find, associate, options, function (error) {
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
  var options = {multi: true};

  return new RSVP.Promise(function (resolve, reject) {
    // Dissociation
    var dissociate = {$pull: {}};
    dissociate.$pull[field.path] = resource._id;
    var find = {};
    find[field.path] = resource._id;

    relatedModel.update(find, dissociate, options, function (error) {
      if (error) return reject(error);

      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource._id;
      var find = {_id: {$in: resource[reference.path] || []}};

      relatedModel.update(find, associate, options, function (error) {
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
  _.each(this._schemas[model._name], function (value, key) {
    if (_.isArray(value) ? value[0].ref : value.ref) {
      resource[key] = null;
    }
  });
  return resource;
};

/**
 * Store the underlying DB objects here.
 *
 * @api private
 */
adapter._models = {};

/**
 * Store the underlying schemas here.
 *
 * @api private
 */
adapter._schemas = {};

/**
 * Store Fortune options.
 *
 * @api private
 */
adapter._options = {};

module.exports = adapter;
