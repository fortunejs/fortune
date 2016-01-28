var mongoose = require('mongoose');
var Promise = require('bluebird').Promise;
var _ = require('lodash');
var uuid = require('node-uuid');

var uuidRegexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/*!
 * ReplSet connection string check.
 */
var rgxReplSet = /^.+,.+$/;


function Adapter() {
    var adapter = {};
    adapter._init = function (options) {
      var connectionString = options.connectionString || '';
      var oplogConnectionString = options.oplogConnectionString || '';

      if (!connectionString.length) {
          connectionString = 'mongodb://' +
          (options.username ? options.username + ':' + options.password + '@' : '') +
          options.host + (options.port ? ':' + options.port : '') + '/' + options.db;
      }

      // always include keepAlive in connection options
      // see: http://mongoosejs.com/docs/connections.html
      var keepAlive = {keepAlive: 1};
      var gooseOpt = options.flags || {};
      gooseOpt.server = gooseOpt.server || {};
      gooseOpt.server.socketOptions = gooseOpt.server.socketOptions || {};
      _.assign(gooseOpt.server.socketOptions, keepAlive);
      if (rgxReplSet.test(connectionString)) {
        gooseOpt.replset = gooseOpt.replset || {};
        gooseOpt.replset.socketOptions = gooseOpt.replset.socketOptions || {};
        _.assign(gooseOpt.replset.socketOptions, keepAlive);
      }

      function handleDbError(err){
        console.error(err);
        throw err;
      }

      this.db = mongoose.createConnection(connectionString, _.cloneDeep(gooseOpt));
      this.db.on('error', handleDbError);

      this.oplogDB = mongoose.createConnection(oplogConnectionString, _.cloneDeep(gooseOpt));
      this.oplogDB.on('error', handleDbError);
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

        schema._id = {
            type : String,
            default : function() {
              return uuid.v4();
            }
        };

        _.each(schema, function (val, key) {
            var obj = {};
            var isArray = _.isArray(val);
            var value = isArray ? val[0] : val;
            var isObject = _.isPlainObject(value);
            var ref = isObject ? value.ref : value;

            // Convert strings to associations
            if (typeof ref == 'string') {
                obj.ref = ref;
                obj.type = String;
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

    adapter.update = function (model, id, update, options) {
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

            if (options) {
                options.new = true;
                model.findByIdAndUpdate(id, update, options, cb);
            } else {
                model.findByIdAndUpdate(id, update, {new : true}, cb);
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

            model.findOneAndUpdate(query, update, {update: true, new: true}, cb);
        });
    }

    adapter.delete = function (model, id) {
        var _this = this;
        model = typeof model == 'string' ? this.model(model) : model;
        return new Promise(function (resolve, reject) {
            model.findByIdAndRemove(id, function (error, resource) {
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

        if (_.isObject(query)) {
            query.id && (query._id = query.id) && delete query.id;
        }
        query && query._id && _.isArray(query._id) && (query._id = {$in: query._id});

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
        sort = sort || {"_id": -1};
        var arr = fields ? fields.split(" ") : [];
        _.each(arr, function (field, index) {
            arr[index] = field.replace("links.", "");
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
            // check whether db isn't already in connected state
            // if so it wil not emit the connected event and therefore can keep the promise dangling
            if (_this.db._readyState == 1) {
                return resolve();
            }
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
        if (resource.id) {
            resource._id = resource.id;
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
        if (!resource) {
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
            //Distinguish between refs with UUID values and properties with UUID values
            var hasManyRef = (type.options.type && type.options.type[0] && type.options.type[0].ref);
            var isRef = !!(type.options.ref || hasManyRef);
            var instance = type.instance ||
                (type.caster ? type.caster.instance : undefined);
            if (path != '_id' && instance == 'String' && uuidRegexp.test(resource[path]) && isRef) {
                return relations.push(path);
            }

            if (resource[path] && resource[path].forEach) {

                var isLink = _.every(resource[path], function(item) {
                    return uuidRegexp.test(item);
                });

                if(isLink) relations.push(path);
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
        resolve(_this._deserialize(model, resource));
    };

    // expose mongoose
    adapter.mongoose = mongoose;
    return adapter;
}
module.exports = Adapter;
