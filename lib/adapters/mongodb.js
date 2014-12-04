var mongoose = require('mongoose');
var RSVP = require('rsvp');
var _ = require('lodash');
var moment = require("moment");
var Promise = RSVP.Promise;
var adapter = {};

adapter._init = function (options) {
  var connectionString = options.connectionString;

  if (!connectionString || !connectionString.length) {
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
    if (model.pk){
      resource[model.pk] = id;
    } else{
      resource.id = id;
    }
  }

  model = typeof model == 'string' ? this.model(model) : model;
  resource = this._serialize(model, resource);
  return new Promise(function (resolve, reject) {

    var upsert = _this._shouldUpsert(model, resource);

    if (upsert.status) {
      var update = _this._serialize(model, resource);
      function tryUpsert(count){
        return new Promise(function(resolve, reject){
          model.findOneAndUpdate(upsert.match, update, upsert.opts, function(error, r) {
            if (error) return reject(error);
            resolve(r);
          });
        }).catch(function(err){
          if (count < 5){
            tryUpsert(count++);
          }else{
            throw err;
          }
        });
      }
      tryUpsert().then(function(r){
        _this._handleWrite(model, r, null, resolve, reject);
      }, function(err){
        reject(err);
      });
    } else {
      model.create(resource, function(error, resource) {
        _this._handleWrite(model, resource, error, resolve, reject);
      });
    }

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

    var modifiedRefs = _this._getModifiedRefs(update);
    model.findOneAndUpdate(match, update, function(error, resource) {
      if (_.isNull(resource)) return resolve();
      _this._handleWrite(model, resource, error, resolve, reject, modifiedRefs);
    });
  });
};

adapter.markDeleted = function(model, id){
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  var pk = model.pk || "_id";

  if(_.isArray(id)) id = {$in: id};

  return new Promise(function(resolve, reject) {
    var match = {};
    if(id) match[pk] = id;

    model.find(match).exec(function(error,resources){
      if (error) return reject(error);

      RSVP.all(_.map(resources, function(resource){
        return new Promise(function(resolve, reject) {
          var references = getReferences(model);

          var links = _.reduce(references, function (memo, ref) {
            memo[ref.path] = resource[ref.path];
            return memo;
          }, {});

          model.findOneAndUpdate(match, {$set: {_links: links}, deletedAt: new Date()}, function (error) {
            if (error) {
              reject(error);
            } else {
              resolve(resource);
            }
          });
        });
      })).then(function(resources){
        resolve(resources);
      }, function(err){
        reject(err);
      });
    });
  }).then(function(resources){
      return RSVP.all(_.map(resources, function(resource){
        return _this._dissociate(model, resource).then(function(){
          return _this._deserialize(model, resource);
        });
      }));
    });
};

adapter.delete = function (model, id) {
  var _this = this;
  model = typeof model == 'string' ? this.model(model) : model;
  var pk = model.pk || "_id";

  if(_.isArray(id)) id = {$in: id};

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
      return _this._dissociate(model, resource).then(function(){
        return _this._deserialize(model, resource);
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
adapter.find = function(model, query, projection){
  if (!_.isObject(query)) query = {id: query};
  projection = projection || {};
  projection.limit = 1;
  return new Promise(function(resolve, reject){
    adapter.findMany(model, query, projection).then(function(resources){
      if(!resources || resources.length === 0) {
        return reject();
      }
      return resolve(resources[0]);
    }, function(err){
      reject(err);
    });
  });
};

var deepReplaceIds = function(dbQuery, pk){
  var result = {};
  _.each(dbQuery, function(v, k){
    if (k === '$and' || k === '$or') {
      result[k] = _.map(v, function(subQ){
        return deepReplaceIds(subQ, pk);
      });
    }else if (k === 'id'){
      result[pk] = v;
    }else{
      result[k] = v;
    }
  });
  return result;
};

var deepReplaceFalsies = function(query){
  _.each(query, function(val, key){
    if(val === "null"){
      query[key] = null;
    }else if(val === "undefined"){
      query[key] = undefined;
    }else if(_.isObject(val)){
      if(_.isArray(val)){
        val = _.map(val, function(item){
          if(item === "null") return null;
          if(item === "undefined") return undefined;
          return item;
        });
      }else{
        deepReplaceFalsies(val);
      }
    }
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

  function parseQuery(query){
    query = _.clone(query);

    _.each(query, function(val, key){
      var m;
      if(_.isNull(val) || _.isUndefined(val)){
        if(key[0] === "$") delete query[key]; // clean up props like $in: undefined
      }else if(model.schema.tree[key] === Date && _.isString(val)){
        //Strict date equality
        m = moment(val);

        if(m.format("YYYY-MM-DD") === val){
          query[key] = {
            $gte: val,
            $lte: moment(val).add("days", 1).format("YYYY-MM-DD")
          };
        }
      }else if ((model.schema.tree[key] === Date || model.schema.tree[key] === Number) && _.isObject(val)){
        //gt/gte/lt/lte for dates and numbers
        query[key] = _.reduce(val, function(memo, opVal, op){
          memo[{ "gt": "$gt", "gte": "$gte", "lt": "$lt", "lte": "$lte" }[op] || op] = opVal;
          return memo;
        }, {});
      }else if (_.isString(val.in || val.$in)){
        query[key] = {
          $in: (val.in || val.$in).split(',')
        };
      }else if (_.isObject(val) && _.isString(val.regex)){
        //regex
        query[key] = {
          $regex: val.regex ? val.regex : '',
          $options: val.options ? val.options : ''
        };
      }else if(_.isObject(val) && (_.has(val, 'exists') || _.has(val, '$exists'))){
        query[key] = {$exists: true};
      }else if(key === 'or' || key === 'and') {
        query['$' + key] = _.map(val, parseQuery);
        delete query[key];
      }else if(key === '$or' || key === '$and'){
        query[key] = _.map(val, parseQuery);
      }
    });


    if(_.isObject(query)){
      if(_.isArray(query)) {
        if (query.length === 1) {
          dbQuery[pk] = query[0];
        }else if(query.length) {
          dbQuery[pk] = {$in: query};
        }
      }else{
        dbQuery = _.clone(query);

        deepReplaceFalsies(dbQuery);
      }
    }

    return deepReplaceIds(dbQuery, pk);
  }

  if (_.isObject(query)){
    query = parseQuery(query);
  }else if(typeof query === 'number' && arguments.length === 2){
    //Just for possible backward compatibility issues
    projection = projection || {};
    projection.limit = query;
  }

  projection = projection || {};
  //if limit is zero we just don't set it. (or use the default if exists)
  if(!_.isNumber(projection.limit)){
    projection.limit =  model.schema.options.defaultLimit;
  }

  projection.select = projection.select || '';
  projection.skip = 0;

  if (projection.page && projection.page > 0) {
    projection.skip = (projection.page - 1) * projection.pageSize;
    // console.log("skip", projection.skip);
    projection.limit = projection.pageSize;
  }

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
    //Take care of deleted resources
    query = query || {};
    if (projection && !projection.includeDeleted) query.deletedAt = {$exists: false};
    var q = model.find(query)
          .limit(projection.limit)
          .select(projection.select);
    if (projection.sort){
      q.sort(projection.sort);
    }
    q.skip(projection.skip)
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
    var pk = model.pk || "_id",
        pkType = model.schema.tree[pk];

    if(!_.isFunction(pkType)){
      if(!(pkType = pkType.type)){
        throw new Error("Could not determine the type of PK for " + model.modelName);
      }
    }

    resource[pk] = pkType(resource[pk] || resource.id);
    if (!resource[pk]){
      //If failed to cast - generate ObjectId from provided .id
      resource._id = mongoose.Types.ObjectId(resource.id.toString());
    }

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
  resource = resource.toObject && resource.toObject() || resource;

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
 * @param {Array} modifiedRefs
 */
adapter._handleWrite = function (model, resource, error, resolve, reject, modifiedRefs) {
  var _this = this;
  if (error) {
    return reject(error);
  }
  this._updateRelationships(model, resource, modifiedRefs).then(function(resource) {
    resolve(_this._deserialize(model, resource));
  }, function (error) {
    reject(error);
  });
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
  return getKeys(update);

  function getKeys(cmd){
    var keys = [];
    _.each(cmd, function(value, key){
      if (key.indexOf('$') === 0) {
        keys = keys.concat(getKeys(value));
      }else{
        keys.push(key);
      }
    });
    return keys;
  }
};

/**
 * Inspects provided model and returns array of references.
 */
function getReferences(model, modifiedRefs){
  var references = [];
  _.each(model.schema.tree, function (value, key) {
    var singular = !_.isArray(value);
    var obj = singular ? value : value[0];
    if (typeof obj == 'object' && obj.hasOwnProperty('ref')) {
      if (_.isUndefined(modifiedRefs) || modifiedRefs.indexOf(key) !== -1){
        references.push({
          path: key,
          model: obj.ref,
          singular: singular,
          inverse: obj.inverse,
          isExternal: obj.external
        });
      }
    }
  });
  return references;
}

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
  var _this = this;

  /**
   * Get fields that contain references.
   */

  var references = getReferences(model, modifiedRefs);


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
  // Dissociation
  var dissociate = {$unset: {}};
  var pk = model.pk || "_id";
  var match = {};
  match[field.path] = resource[pk];

  dissociate.$unset[field.path] = resource[pk];
  //relatedModel.where(field.path, resource[pk]).update(dissociate, function(error) {

  return wrapAsyncCall(relatedModel, relatedModel.update, match, dissociate)
    .then(function(){
      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource[model.pk || "_id"];

      var match = {};
      match[relatedModel.pk || "_id"] = resource[reference.path];

      return wrapAsyncCall(relatedModel, relatedModel.findOneAndUpdate, match, associate);
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
  // Dissociation
  var dissociate = {$pull: {}},
      pk = model.pk || "_id",
      match = {};
  match[field.path] = resource[pk];

  dissociate.$pull[field.path] = resource[pk];

  return wrapAsyncCall(relatedModel, relatedModel.update, match, dissociate)
    .then(function(){
      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource[model.pk || "_id"];

      var match = {};
      match[relatedModel.pk || "_id"] = resource[reference.path];

      return wrapAsyncCall(relatedModel, relatedModel.findOneAndUpdate, match, associate);
    });
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
  // Dissociation
  var dissociate = {$unset: {}},
      pk = model.pk || "_id",
      match = {};
  match[field.path] = resource[pk];

  dissociate.$unset[field.path] = 1;

  return wrapAsyncCall(relatedModel, relatedModel.update, match, dissociate)
    .then(function(){
      // Association
      var associate = {$set: {}};
      associate.$set[field.path] = resource[model.pk || "_id"];

      var match = {};
      match[relatedModel.pk || "_id"] = {$in: resource[reference.path] || []};

      return wrapAsyncCall(relatedModel, relatedModel.update, match, associate, {multi: true});
    }).then(function(){
      return unbindRedundant(model, relatedModel, resource, reference.path, field.path);
    });
};

function unbindRedundant(model, relatedModel, resource, refFrom, refTo){
  if (!resource[refFrom]) return;
  var modelPK = model.pk || "_id";
  var relatedPK = relatedModel.pk || "_id";
  //First find matching doc to get it's id
  var match = {
    $and: [
      buildQueryObject(relatedPK, {$in: resource[refFrom]}),
      buildQueryObject(refTo, resource[modelPK])
    ]
  };
  return wrapAsyncCall(relatedModel, relatedModel.findOne, match)
    .then(function(matching){
      if (matching){
        var selfMatch = {
          $and: [
            //Ignore reference we need to persist
            buildQueryObject(modelPK, {$ne: matching[refTo]}),
            //Match all other docs that have ref to `matching`
            buildQueryObject(refFrom, {$in: [matching[relatedPK]]})
          ]
        };
        //Pull every matching binding
        var unbind = {
          $pull: buildQueryObject(refFrom, matching[relatedPK])
        };
        return wrapAsyncCall(model, model.update, selfMatch, unbind, {multi: true});
      }
    });
}


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
  // Dissociation
  var dissociate = {$pull: {}},
      pk = model.pk || "_id",
      match = {};
  match[field.path] = resource[pk];

  dissociate.$pull[field.path] = resource[pk];

  return wrapAsyncCall(relatedModel, relatedModel.update, match, dissociate, {multi: true})
    .then(function(){
      // Association
      var associate = {$addToSet: {}};
      associate.$addToSet[field.path] = resource[model.pk || "_id"];

      //var ids = {_id: {$in: resource[reference.path] || []}};

      var match = {};
      match[relatedModel.pk || "_id"] = {$in: resource[reference.path] || []};

      return wrapAsyncCall(relatedModel, relatedModel.update, match, associate, {multi:true});
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
  var resourceId = resource[model.pk] || resource.id;
  var promises = [];
  _.each(model.schema.tree, function(branch, path){
    if (isLocalRef(branch)){
      var values = _.isArray(resource[path]) ? resource[path] : _.isUndefined(resource[path]) ? [] : [resource[path]];
      var relatedModel = adapter.model(_.isArray(branch) ? branch[0].ref : branch.ref);
      var inverse = _.isArray(branch) ? branch[0].inverse : branch.inverse;
      var upd = {};
      if (_.isArray(relatedModel.schema.tree[inverse])){
        upd.$pull = {};
        upd.$pull[inverse] = resourceId;
      }else{
        upd.$unset = {};
        upd.$unset[inverse] = true;
      }
      promises.push(RSVP.all(values.map(function(id){
        return adapter.update(relatedModel, id, upd);
      })));
    }
  });
  return RSVP.all(promises);
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
  opts = opts || {};


  var paths = model.schema.paths,
    keys    = model.schema.upsertKeys,
    matches = [],
    match   = {},
    status  = keys.length > 0 && _.every(keys, function(key) {
      var result = _.has(paths, key);
      if (result) matches.push(key);
      return result;
    });

  // Construct the match object based upon the resource itself and the first
  // of the keys matched against the schema.
  if (status && matches.length) {

    var matchKey = matches[0];

    // We only handle a depth of two here, ie. a key like `nested1.field2`
    if (/\./.test(matchKey)) {
      var parts = matchKey.split("."),
        first   = parts[0],
        second  = parts[1];

        if (_.has(resource, first) && _.has(resource[first], second) && !!resource[first][second]) {
          match[first + "." + second] = resource[first][second];

          status = true;
        }

    // Otherwise just handle a depth of one, ie. `field1`
    } else if (resource[matchKey] && !!resource[matchKey]) {
      match[matchKey] = resource[matchKey];

      status = true;
    }

  }

  // If the resulting match object is empty, we cannot do a find and update.
  if (!_.keys(match).length) {
    status = false;
  }

  return {
    status : status,
    match  : match,
    opts   : _.extend(opts, { upsert : status })
  };
};

function isLocalRef(branch){
  if (_.isArray(branch)) {
    return !!(branch[0].ref && branch[0].inverse && !branch[0].external);
  }else{
    return !!(branch.ref && branch.inverse && !branch.external);
  }
}

// expose mongoose
adapter.mongoose = mongoose;

module.exports = adapter;

//Helpers

function wrapAsyncCall(context, fn){
  var args = Array.prototype.slice.call(arguments, 2);
  return new Promise(function(resolve, reject){
    args.push(asyncCallback);
    fn.apply(context, args);

    function asyncCallback(err, result){
      if (err) return reject(err);
      resolve(result);
    }
  });
}

function buildQueryObject(key, value){
  var temp = {};
  temp[key] = value;
  return temp;
}
