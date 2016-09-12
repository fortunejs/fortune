var path = require('path');

var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
var inflect = require('i')();
var SSE = require('./sse');

var Adapter = require('./adapter');
var route = require('./route');

var sendError = require('./send-error');

/*!
 * The Harvester object.
 */
function Harvester() {
    /**
     * Store loaded schemas here.
     *
     * @api private
     */
    this._schema = {};
    this._init.apply(this, arguments);
}

/**
 * Get a promise for a specific routeCreated event.
 * * @param {String} name - the name of the route you want the callback to apply to
 * - The callback will be passed the newly created route.
 */

/**
 * An object that is passed in to the Harvester constructor, which contains all of the configuration options.
 *
 * ### Database setup
 * - `adapter`: may be either "mongodb", "mysql", "psql", "sqlite", or an adapter object. Default: `mongodb`.
 * - `db`: the name of the database to use. Default: `harvester`.
 * - `host`: the address of the database machine. Default: `localhost`.
 * - `port`: the port of the database machine. Do not set this unless you do not plan on using the default port for the database.
 * - `username`: username for logging into the database. This may be optional for MongoDB.
 * - `password`: password for logging into the database. This may be optional for MongoDB.
 * - `flags`: an optional hash containing additional options to pass to the adapter.
 * - `path`: relative path to directory where your database will be stored (NeDB specific). Default: `./data/`.
 * - `connectionString`: an optional string that overrides all database connection options, this is specific to the adapter. Default: `''`.
 *
 * ### Harvester setup
 * - `baseUrl`: optional prefix for URLs, i.e. `http://api.example.com`.
 * - `namespace`: optional namespace for your API, i.e. `api/v1`.
 * - `inflect`: Boolean value that determines whether strings should automatically be pluralized and singularized. Default: `true`.
 * - `suffix`: optional suffix to every route, for example, `/posts.json`, `/posts/1.json`, `/posts/1/comments.json`.
 * - `cors`: boolean value indicating whether or not to enable Cross Origin Resource Sharing (CORS), or an object that contains additional configuration keys: `headers` (Array), `methods` (Array), `origins` (Array), and `credentials` (Boolean). Default: true.
 * - `environment`: if this is set to `"production"`, responses will have whitespace stripped. Default: `process.env.NODE_ENV`.
 *
 * *Note: in order to use database adapters, you must install `harvester-mongodb` for MongoDB, or `harvester-relational` for relational databases.*
 */
Harvester.prototype.options = {};

/**
 * Default application settings.
 *
 * @api private
 */
Harvester.prototype._defaults = {

  // database setup
  adapter: 'mongodb',
  host: 'localhost',
  port: null,
  db: 'harvester',
  username: '',
  password: '',
  flags: {},
  path: path.normalize(__dirname) + '/../data/',
  connectionString: '',

  // harvester options
  baseUrl: '',
  namespace: '',
  suffix: '',
  inflect: true,
  cors: true,
  environment: process.env.NODE_ENV

};

/**
 * Constructor method.
 *
 * @api private
 * @param {Object} options
 */
Harvester.prototype._init = function (options) {
    var router, harvesterInstance = this;

    // Initialize options.
    options = typeof options === 'object' ? options : {};
    for (var key in this._defaults) {
        if (!options.hasOwnProperty(key)) {
            options[key] = this._defaults[key];
        }
    }
  this.options = options;

  // Create the underlying express framework instance.
  this.router = express();
  router = this.router;



  // Setup express.
  if (typeof options.cors === 'boolean' || typeof options.cors === 'object' && options.cors) {
    router.use(allowCrossDomain(options.cors));
  }
  router.disable('x-powered-by');
  router.use(bodyParser.json(options.bodyParser));


  // Create a database adapter instance.
  this.adapter = new Adapter(options);

  this.changeHandlers = {};

    route.getRouteMethodNames().forEach(function (httpMethod) {
        harvesterInstance[httpMethod] = function () {
            var resource = harvesterInstance.createdResources[harvesterInstance._resource];
            return resource[httpMethod].apply(resource);
        }
    });

  this.multiSSE = new SSE();
  this.multiSSE.init({
    context: this
  });
};

/**
 *
 *
 * @param {Object} schema
 * @return {Object}
 */
Harvester.prototype.onChange = function (name, handlers) {
  var that = this;
  if (!handlers) {
      handlers = name;
      name = that._resource;
  }

  //Adapter._model ->  singleton; so multiple fortunes cannot create the same routes. This patch supports giving event-reader it's own harvest while testing.
  !(that.changeHandlers[name]) && (that.changeHandlers[name]=[]);

  that.changeHandlers[name].push(handlers);

  return that;

};

/**
 * Define a resource and setup routes simultaneously. A schema field may be either a native type, a plain object, or a string that refers to a related resource.
 *
 * Valid native types: `String`, `Number`, `Boolean`, `Date`, `Array`, `Buffer`
 *
 * Alternatively, the object format must be as follows:
 *
 * ```javascript
 * {type: String} // no association
 * {ref: 'relatedResource'} // "belongs to" association to "relatedResource"
 * 'relatedResource' // "belongs to" association to "relatedResource"
 * ['anotherResource'] // "has many" one-way association to "anotherResource"
 * ```
 *
 * @param {String} name the name of the resource
 * @param {Object} schema the schema object to add
 * @param {Object} options additional options to pass to the schema
 * @return {this}
 */
Harvester.prototype.resource = function (name, resourceSchema, options) {
  var _this = this;

  this._resource = name;

  if (typeof resourceSchema !== 'object') {
    return this;
  }
  //adapter.model stores data like a singleton, so we use changeHandlers to let us know if the route was created.
  if (this.adapter.model(name)) {
    console.warn('Warning: resource "' + name + '" was already defined.');
    return this;
  }

  // todo refactor this, aim for a bit more functional programming here and keep variables immutable
  // avoid transferring this context to another function, adds complexity

  var resourceSchemaClone = _.clone(resourceSchema);
  var legacyResourceSchema = this._convertToLegacySchema(resourceSchemaClone);
  var processedLegacySchema = this._preprocessSchema(legacyResourceSchema);
  // Store a copy of the input.
  this._schema[name] = _.clone(processedLegacySchema);
  this.changeHandlers[name] = [];

  var mongooseSchema = _this.adapter.schema(name, processedLegacySchema, options);
    this.createdResources = this.createdResources || {};
    this.createdResources[name] = new route(_this, name, _this.adapter.model(name, mongooseSchema), _.clone(resourceSchema), options);

    return this;
};

/**
 * Make sure a schema doesn't have reserved keys before passing it off to the adapter.
 *
 * @api private
 * @param {Object} schema
 * @return {Object}
 */
Harvester.prototype._preprocessSchema = function (schema) {
  ['id', 'href', 'links'].forEach(function (reservedKey) {
    if (schema.hasOwnProperty(reservedKey)) {
      delete schema[reservedKey];
      console.warn('Reserved key "' + reservedKey + '" is not allowed.');
    }
  });
  return schema;
};

Harvester.prototype._convertToLegacySchema = function(schema) {
  var legacySchema = {};
  var schemaMap = {
    'string' : String,
    'number' : Number,
    'date' : Date,
    'buffer' : Buffer,
    'boolean' : Boolean,
    'array' : Array,
    'any': Object
  };

    var that = this;
    _.each(schema, function(schemaItem, key) {
    if(schemaItem.isJoi) {
      legacySchema[key] = schemaMap[schemaItem._type];
        if (schemaItem._type === 'object') {
            var subSchema = {};
            _.forEach(schemaItem._inner && schemaItem._inner.children, function (child) {
                subSchema[child.key] = child.schema;
            });
            legacySchema[key] = that._convertToLegacySchema(subSchema);
        }
    } else if(key === 'links') {
        _.each(schemaItem, function(linkItem, key) {
           legacySchema[key] = linkItem;
        });
    } else {

      legacySchema[key] = schemaItem;
    }
  });

  return legacySchema;

}

/**
 * Internal method to add transforms on a resource.
 *
 * @api private
 * @param {String} name
 * @param {Function} fn
 * @param {String} stage
 */
Harvester.prototype._addTransform = function (name, fn, stage) {
  var _this = this;

  if (typeof name === 'function') {
    fn = name;
    name = this._resource;
  }
  if (typeof fn === 'function') {
    name.split(' ').forEach(function (key) {
      _this[stage][key] = fn;
    });
  }
};

/**
 * Do something before a resource is saved in the database.
 * The callback function has two optional parameters, the request and response objects, respectively.
 * It may return either the resource or a promise. Here's a contrived
 * example that stores the Authorization header into a resource:
 *
 * ```javascript
 * app.before('resource', function (request, response) {
 *   var authorization = request.get('Authorization');
 *   if (!authorization) throw new Error('Authorization failed');
 *   this.authorization = authorization;
 *   return this;
 * });
 * ```
 *
 * @param {String} name may be space separated, i.e. 'cat dog human'
 * @param {Function} fn this callback function is called within the context of the resource, and has two optional parameters: the request and response objects, respectively.
 * @return {this}
 */
Harvester.prototype.before = function (name, fn) {
  this._addTransform(name, fn, '_before');
  return this;
};

/**
 * Do something after a resource is read from the database.
 * The callback function has two optional parameters, the request and response objects, respectively.
 * It may return either the resource or a promise. Here's a contrived
 * example that hides a `password` and `salt` from being exposed:
 *
 * ```javascript
 * app.after('user', function () {
 *   delete this.password;
 *   delete this.salt;
 *   return this;
 * });
 * ```
 *
 * @param {String} name may be space separated, i.e. 'cat dog human'
 * @param {Function} fn this callback function is called within the context of the resource, and has two optional parameters: the request and response objects, respectively.
 * @return {this}
 */
Harvester.prototype.after = function (name, fn) {
  this._addTransform(name, fn, '_after');
  return this;
};

/**
 * Export map of all defined roles and it's permissions.
 *
 * @returns {{}} map or roles and permissions, i.e. {Admin:['person.getById','person.putById'], Moderator: ['person.get', 'user.post']}
 */
Harvester.prototype.exportRoles = function () {
    var roles = {};
    /**
     * For each resource get all it's rest method (endpoint) and check if there are roles assigned directly to that rest method.
     * If yes, then for each such role assign permission to that rest method;
     * otherwise for each role defined on resource assign permission to that rest method.
     */
    _.forEach(this.createdResources, function (resource) {
        route.getRouteMethodNames().forEach(function (restMethodName) {
            var restMethod = resource[restMethodName]();
            if (restMethod.options.notAllowed) {
                return;
            }
            var methodRoles = restMethod.roles;
            var permission = restMethod.getPermissionName();
            if (!_.isEmpty(methodRoles)) {
                /*If roles are NOT defined on method level, then for each role defined on resource assign permission to that rest method;*/
                _.forEach(methodRoles, function (role) {
                    roles[role] = roles[role] || [];
                    roles[role].push(permission);
                });
            } else {
                /*If roles are defined on method level, then for each such role assign permission to that rest method;*/
                _.forEach(resource.roles, function (role) {
                    roles[role] = roles[role] || [];
                    roles[role].push(permission);
                });
            }
        });
    });
    /**
     * Remove duplicates
     */
    _.forEach(roles, function (permissions, role) {
        roles[role] = _.uniq(permissions);
    });
    return roles;
};

Harvester.prototype.exportPermissions = function () {
    var permissions = [];
    _.forEach(this.createdResources, function (resource) {
        _.forEach(route.getRouteMethodNames(), function (restMethodName) {
            var restMethod = resource[restMethodName]();
            if (!restMethod.isAllowed()) {
                return;
            }
            permissions.push(restMethod.getPermissionName());
        });
    });
    return permissions;
};

/**
 * Set roles allowed to access most recently defined/referenced resource.
 *
 * i.e. harvesterApp.resource('person').roles('Admin', 'Moderator');
 *
 * @returns {this}
 */
Harvester.prototype.roles = function () {
    this.createdResources[this._resource].roles = Array.prototype.slice.call(arguments);
    return this;
};

/**
 * Convenience method to define before & after at once.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used
 * @param {Function} before see "before" method
 * @param {Function} after see "after" method
 * @return {this}
 */
Harvester.prototype.transform = function (name, before, after) {
  if (typeof name !== 'string') {
    after = before;
    before = name;
    name = this._resource;
  }
  this.before(name, before);
  this.after(name, after);
  return this;
};

/**
 * This accepts a `connect` middleware function. For more information, [here is a guide for how to write connect middleware](http://stephensugden.com/middleware_guide/).
 *
 * @param {Function} fn connect middleware
 * @return {this}
 */
Harvester.prototype.use = function () {
  var router = this.router;
  router.use.apply(router, arguments);
  return this;
};

/**
 * Start the API by listening on the specified port.
 *
 * @param {Number} port the port number to use
 * @return {this}
 */
Harvester.prototype.listen = function () {
  var router = this.router;

  router.use(function (err, req, res, next) {
    if (err) {
      sendError(req, res, err);
    } else {
      next();
    }
  });

  router.listen.apply(router, arguments);
  console.log('A harvester is available on port ' + arguments[0] + '...');
  return this;
};

/**
 * Internal method to remove HTTP routes from a resource.
 *
 * @api private
 * @param {String} name
 * @param {Array} methods
 * @param {Array} [routes]
 */

// Does not work... incorrectly implemented
Harvester.prototype._removeRoutes = function (name, methods, routes) {
  var router = this.router;
  var collection = this.options.inflect ? inflect.pluralize(name) : name;
  var re = new RegExp('\/' + collection);

  this.adapter.awaitConnection().then(function () {
    (methods || []).forEach(function (verb) {
//        TODO imho this method is badly implemented. `router` does not have `routes` property.
      var paths = router.routes[verb];
      paths.forEach(function (route, index) {
        if (routes ? _.contains(routes, route.path) : re.test(route.path)) {
          paths.splice(index, 1);
        }
      });
    });
  });
};

/**
 * Mark a resource as read-only, which destroys the routes
 * for `POST`, `PUT`, `PATCH`, and `DELETE` on that resource. The resource
 * can still be modified using adapter methods.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used.
 * @return {this}
 */
Harvester.prototype.readOnly = function (name) {
    if (typeof name !== 'string') {
        name = this._resource;
    }

    this.createdResources[name].readOnly();
    return this;
};

/**
 * Mark a resource as restricted, which destroys all routes on that resource. The resource
 * can still be modified using adapter methods.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used.
 * @return {this}
 */
Harvester.prototype.restricted = function (name) {
    if (typeof name !== 'string') {
        name = this._resource;
    }

    this.createdResources[name].restricted();
    return this;
};

/**
 * Mark a resource as immutable, which destroys the routes
 * for `PUT`, `PATCH`, and `DELETE` on that resource. The resource
 * can still be modified using adapter methods.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used.
 * @return {this}
 */
Harvester.prototype.immutable = function (name) {
    if (typeof name !== 'string') {
        name = this._resource;
    }

    this.createdResources[name].immutable();
    return this;
};

/**
 * Mark a resource as not having an index, which destroys the `GET` index.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used.
 * @return {this}
 */

// Does not work... 'removeRoutes' is not correctly implemented
Harvester.prototype.noIndex = function (name) {
  if (typeof name !== 'string') {
    name = this._resource;
  }

  var collection = this.options.inflect ? inflect.pluralize(name) : name;
  var index = [this.options.namespace, collection].join('/');

  this._removeRoutes(name, ['get'], [index]);
  return this;
};

/**
 * Registers authorization callback.
 *
 * harvester.setAuthorizationStrategy(function(req){
 *     //Here's all possible return types and how they should be handled.
 *     return promise;
 *          //resolved means authorized if not an instance of Error or JSONAPI_Error,
*           //if resolved promise is err or jsonapi error, treated as below
 *          //rejected means not authorized and return 403 jsonapi error.
 *     return JSONAPI_Error; //serialize and send this jsonapi error
 *
 *     throw new Error; //should become a 500 error by default, which is correct here.
 *     throw new JSONAPI_Error; //serialize and send this jsonapi error
 *     //any other return type, its a 500.
 * });
 * @param callback function
 * @returns {this}
 */
Harvester.prototype.setAuthorizationStrategy = function (strategy) {
    this.authorizationStrategy = strategy;
    return this;
};

/**
 * Namespace for the router, which is actually an instance of `express`.
 */
Harvester.prototype.router = {};

/**
 * Namespace for the adapter.
 */
Harvester.prototype.adapter = {};

/**
 * Store methods to transform input.
 *
 * @api private
 */
Harvester.prototype._before = {};

/**
 * Store methods to transform output.
 *
 * @api private
 */
Harvester.prototype._after = {};

/**
 * Keep track of the last added resource so that we can
 * chain methods that act on resources.
 *
 * @api private
 */
Harvester.prototype._resource = '';


// Default Cross-Origin Resource Sharing setup.
function allowCrossDomain (cors) {

  var headers = cors.headers || ['Accept', 'Content-Type', 'Authorization', 'X-Requested-With'];
  var methods = cors.methods || ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'];
  var origins = cors.origins || '*';
  var credentials = cors.credentials || true;

  return function (req, res, next) {
    var origin = req.get('Origin');

    if (!origin) {
      return next();
    }

    if (origins !== '*') {
      if (origins.indexOf(origin)) {
        origins = origin;
      } else {
        next();
      }
    }

    res.header('Access-Control-Allow-Origin', origins);
    res.header('Access-Control-Allow-Headers', headers.join(', '));
    res.header('Access-Control-Allow-Methods', methods.join(', '));
    res.header('Access-Control-Allow-Credentials', credentials.toString());

    // intercept OPTIONS method
    if (req.method === 'OPTIONS') {
      res.send(200);
    } else {
      next();
    }
  };
}

/*!
 * Create instance of Harvester.
 *
 * @param {Object} options
 */
function create (options) {
  return new Harvester(options);
}

// Expose create method
exports = module.exports = create;

// Expose Express framework
exports.express = express;

// Expose Lodash
exports._ = _;

Harvester.prototype.eventsReader = function(oplogMongodbUri) {
    return require('./events-reader')(this)(oplogMongodbUri);
};

exports.JSONAPI_Error = require('./jsonapi-error');
exports.sendError = sendError;
