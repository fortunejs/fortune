var path = require('path');

var express = require('express');
var bodyParser = require('body-parser');
var RSVP = require('rsvp');
var _ = require('lodash');
var inflect = require('i')();

var Adapter = require('./adapter');
var route = require('./route');

/*!
 * The Fortune object.
 */
function Fortune () {
  this._init.apply(this, arguments);
}

/**
 * An object that is passed in to the Fortune constructor, which contains all of the configuration options.
 *
 * ### Database setup
 * - `adapter`: may be either "nedb", "mongodb", "mysql", "psql", "sqlite", or an adapter object. Default: `nedb`.
 * - `db`: the name of the database to use. Default: `fortune`.
 * - `host`: the address of the database machine. Default: `localhost`.
 * - `port`: the port of the database machine. Do not set this unless you do not plan on using the default port for the database.
 * - `username`: username for logging into the database. This may be optional for MongoDB.
 * - `password`: password for logging into the database. This may be optional for MongoDB.
 * - `flags`: an optional hash containing additional options to pass to the adapter.
 * - `path`: relative path to directory where your database will be stored (NeDB specific). Default: `./data/`.
 * - `connectionString`: an optional string that overrides all database connection options, this is specific to the adapter. Default: `''`.
 *
 * ### Fortune setup
 * - `baseUrl`: optional prefix for URLs, i.e. `http://api.example.com`.
 * - `namespace`: optional namespace for your API, i.e. `api/v1`.
 * - `inflect`: Boolean value that determines whether strings should automatically be pluralized and singularized. Default: `true`.
 * - `suffix`: optional suffix to every route, for example, `/posts.json`, `/posts/1.json`, `/posts/1/comments.json`.
 * - `cors`: boolean value indicating whether or not to enable Cross Origin Resource Sharing (CORS), or an object that contains additional configuration keys: `headers` (Array), `methods` (Array), `origins` (Array), and `credentials` (Boolean). Default: true.
 * - `environment`: if this is set to `"production"`, responses will have whitespace stripped. Default: `process.env.NODE_ENV`.
 *
 * *Note: in order to use database adapters, you must install `fortune-mongodb` for MongoDB, or `fortune-relational` for relational databases.*
 */
Fortune.prototype.options = {};

/**
 * Default application settings.
 *
 * @api private
 */
Fortune.prototype._defaults = {

  // database setup
  adapter: 'nedb',
  host: 'localhost',
  port: null,
  db: 'fortune',
  username: '',
  password: '',
  flags: {},
  path: path.normalize(__dirname) + '/../data/',
  connectionString: '',

  // fortune options
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
Fortune.prototype._init = function (options) {
  var router;

  // Initialize options.
  options = typeof options === 'object' ? options : {};
  for(var key in this._defaults) {
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
  router.use(bodyParser.json());

  // Create a database adapter instance.
  this.adapter = new Adapter(options);
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
 * {ref: 'relatedResource', inverse: 'relatedKey'} // "belongs to" association to "relatedKey" key on "relatedResource"
 * [{ref: 'anotherResource', inverse: 'someKey'}] // "has many" association to "someKey" on "anotherResource"
 * [{ref: 'anotherResource', inverse: null}] // "has many" one-way association to "anotherResource"
 * ```
 *
 * @param {String} name the name of the resource
 * @param {Object} schema the schema object to add
 * @param {Object} options additional options to pass to the schema
 * @return {this}
 */
Fortune.prototype.resource = function (name, schema, options) {
  var _this = this;

  this._resource = name;

  if (typeof schema !== 'object') {
    return this;
  }
  if (this.adapter.model(name)) {
    console.warn('Warning: resource "' + name + '" was already defined.');
    return this;
  }

  this.adapter.awaitConnection().then(function () {
    schema = _this._preprocessSchema(schema);

    // Store a copy of the input.
    _this._schema[name] = _.clone(schema);

    try {
      schema = _this.adapter.schema(name, schema, options);
      _this._route(name, _this.adapter.model(name, schema));
    } catch(error) {
      console.trace('There was an error loading the "' + name + '" resource. ' + error);
    }
  }, function (error) {
    console.trace(error);
  });
  return this;
};

/**
 * Make sure a schema doesn't have reserved keys before passing it off to the adapter.
 *
 * @api private
 * @param {Object} schema
 * @return {Object}
 */
Fortune.prototype._preprocessSchema = function (schema) {
  ['id', 'href', 'links'].forEach(function (reservedKey) {
    if (schema.hasOwnProperty(reservedKey)) {
      delete schema[reservedKey];
      console.warn('Reserved key "' + reservedKey + '" is not allowed.');
    }
  });
  return schema;
};

/**
 * Internal method to add transforms on a resource.
 *
 * @api private
 * @param {String} name
 * @param {Function} fn
 * @param {String} stage
 */
Fortune.prototype._addTransform = function (name, fn, stage) {
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
Fortune.prototype.before = function (name, fn) {
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
Fortune.prototype.after = function (name, fn) {
  this._addTransform(name, fn, '_after');
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
Fortune.prototype.transform = function (name, before, after) {
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
Fortune.prototype.use = function () {
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
Fortune.prototype.listen = function () {
  var router = this.router;

  router.listen.apply(router, arguments);
  console.log('A fortune is available on port ' + arguments[0] + '...');
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
Fortune.prototype._removeRoutes = function (name, methods, routes) {
  var router = this.router;
  var collection = this.options.inflect ? inflect.pluralize(name) : name;
  var re = new RegExp('\/' + collection);

  this.adapter.awaitConnection().then(function () {
    (methods || []).forEach(function (verb) {
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
Fortune.prototype.readOnly = function (name) {
  if (typeof name !== 'string') {
    name = this._resource;
  }

  this._removeRoutes(name, ['post', 'put', 'patch', 'delete']);
  return this;
};

/**
 * Mark a resource as not having an index, which destroys the `GET` index.
 *
 * @param {String} [name] if no name is passed, the last defined resource is used.
 * @return {this}
 */
Fortune.prototype.noIndex = function (name) {
  if (typeof name !== 'string') {
    name = this._resource;
  }

  var collection = this.options.inflect ? inflect.pluralize(name) : name;
  var index = [this.options.namespace, collection].join('/');

  this._removeRoutes(name, ['get'], [index]);
  return this;
};

/**
 * Namespace for the router, which is actually an instance of `express`.
 */
Fortune.prototype.router = {};

/**
 * Namespace for the adapter.
 */
Fortune.prototype.adapter = {};

/**
 * Store loaded schemas here.
 *
 * @api private
 */
Fortune.prototype._schema = {};

/**
 * Store methods to transform input.
 *
 * @api private
 */
Fortune.prototype._before = {};

/**
 * Store methods to transform output.
 *
 * @api private
 */
Fortune.prototype._after = {};

/**
 * Method to route a resource.
 *
 * @api private
 */
Fortune.prototype._route = route;

/**
 * Keep track of the last added resource so that we can
 * chain methods that act on resources.
 *
 * @api private
 */
Fortune.prototype._resource = '';


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
 * Create instance of Fortune.
 *
 * @param {Object} options
 */
function create (options) {
  return new Fortune(options);
}

// Expose create method
exports = module.exports = create;

// Expose Express framework
exports.express = express;

// Expose RSVP promise library
exports.RSVP = RSVP;

// Expose Lodash
exports._ = _;
