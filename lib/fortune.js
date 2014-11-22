var path = require('path');

var express = require('express');
var RSVP = require('rsvp');
var _ = require('lodash');
var inflect = require('i')();

var Adapter = require('./adapter');
var route = require('./route');
var hooks = require('./hooks');
var querytree = require('./querytree');
var director = require('./director');
var plugins = require('./plugins');

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
 * - `adapter`: may be either "nedb", "mongodb", "mysql", "psql", "sqlite", or an adapter object. Default: `mongodb`.
 * - `db`: the name of the database to use. Default: `fortune`.
 * - `host`: the address of the database machine. Default: `localhost`.
 * - `port`: the port of the database machine. Do not set this unless you do not plan on using the default port for the database.
 * - `username`: username for logging into the database. This may be optional for MongoDB.
 * - `password`: password for logging into the database. This may be optional for MongoDB.
 * - `flags`: an optional hash containing additional options to pass to the adapter.
 * - `path`: relative path to directory where your database will be stored (NeDB specific). Default: `./data/`.
 * - `connectionString`: an optional string that overrides all database connection options, this is adapter specific and using this is discouraged. Default: `''`.
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
  adapter: 'mongodb',
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
  environment: process.env.NODE_ENV,
  serviceName: null,

  //legacy transforms trap
  throwOnLegacyTransforms: false

};

/**
 * Constructor method.
 *
 * @api private
 * @param {Object} options
 */
Fortune.prototype._init = function (options) {
  var _this = this,
      router;

  // Initialize options.
  options = typeof options === 'object' ? options : {};
  for(var key in this._defaults) {
    if (!options.hasOwnProperty(key)) {
      options[key] = this._defaults[key];
    }
  }
  this.options = options;
  this.inflect = inflect;

  // Create the underlying express framework instance.
  this.router = options.router || express();
  router = this.router;

  this.director = director();
  this.direct = this.director.methods;

  // Setup express.
  if (typeof options.cors === 'boolean' || typeof options.cors === 'object' && options.cors) {
    router.use(allowCrossDomain(options.cors));
  }
  router.disable('x-powered-by');
  router.use(express.json());

  // Create a database adapter instance.
  this.adapter = new Adapter(options, inflect);
};

Fortune.prototype._resourceInitialized = function(){
  this._resourcesStarted ++;
  if (Object.keys(this._resources).length === this._resourcesStarted){
    this._ready = true;
  }
};

Fortune.prototype.resources = function(){
  var _this = this;
  return _.map(_this._resources, function(md, name){
    var schema = _.clone(md.schema);

    _.each(schema, function(v,k){
      var vIsFunction = _.isFunction(v),
          typeFn = vIsFunction ? v : v.type;

      if(typeFn){
        typeFn = typeFn.toString();
        typeFn = typeFn.substr('function '.length);
        typeFn = typeFn.substr(0, typeFn.indexOf('('));

        schema[k] = vIsFunction ? typeFn : _.extend({}, v, {type: typeFn});
      }
    });

    return _.extend({name: name, schema: schema },
                    md.modelOptions && {modelOptions: md.modelOptions},
                    _this.options.serviceName && {service: _this.options.serviceName},
                    {route: _this.inflect.pluralize(name)});
  });
};

Fortune.prototype._exposeResourceDefinitions = function() {
  var _this = this;
  if (this._exposeResourceDefinitionsRouteAdded) return;
  this._exposeResourceDefinitionsRouteAdded = true;

  var resourceRoute = this.options.serviceName ? "/resources/" + this.options.serviceName :
        "/resources";

  this.router.get(resourceRoute, function(req,res){
    if (_this._ready){
      res.write(JSON.stringify({resources: _this.resources()}));
      res.end();
    }else{
      res.writeHead(503);
      res.end();
    }
  });
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
 * @param {Function} optional callback to invoke with the created schema
 * @return {this}
 */
Fortune.prototype.resource = function(name, schema, options, schemaCallback) {
  var _this = this,
      modelOptions  = options && options.model,
      hooksOptions  = options && options.hooks,
      policyOptions = options && options.policy,
      upsertKeys    = options && options.upsertKeys;

  this._resource = name;

  if (typeof schema !== 'object') {
    return this;
  }
  if (this.adapter.model(name)) {
    console.warn('Warning: resource "' + name + '" was already defined.');
    return this;
  }

  this._resources = this._resources || {};
  this._resources[name] = { name: name, schema: schema, modelOptions: modelOptions, hooksOptions: hooksOptions, policy: policyOptions};
  plugins.init(this, this._resources[name]);
  hooks.initGlobalHooks(_this._resources[name], _this.options);
  //Register updates in queryParser. Should be called here to make sure that all resources are registered
  _this._exposeResourceDefinitions();
  _this._querytree = querytree.init(this);

  this.adapter.awaitConnection().then(function () {
    schema = _this._preprocessSchema(schema);

    // Store a copy of the input.
    _this._schema[name] = _.clone(schema);
    try {
      schema = _this.adapter.schema(name, schema, options, schemaCallback);

      // Pass any upsertKeys to the schema
      schema.upsertKeys = upsertKeys || [];

      _this._route(name, _this.adapter.model(name, schema,modelOptions), _this._resources, inflect, _this._querytree);
      _this._resourceInitialized();
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
  ['id', 'href', 'links', 'in', 'or', 'and', 'then', '__isNew', 'deletedAt', '_links'].forEach(function (reservedKey) {
    if (schema.hasOwnProperty(reservedKey)) {
      delete schema[reservedKey];
      console.warn('Reserved key "' + reservedKey + '" is not allowed.');
    }
  });
  //Set up system keys
  schema.deletedAt = Date;
  schema._links = Object;
  return schema;
};


Fortune.prototype.beforeAllRW = function(hooksArray, inlineConfig){
  hooks.registerGlobalHook('_before', 'read', hooksArray, inlineConfig);
  hooks.registerGlobalHook('_before', 'write', hooksArray, inlineConfig);
  return this;
};
Fortune.prototype.afterAllRW = function(hooksArray, inlineConfig){
  hooks.registerGlobalHook('_after', 'read', hooksArray, inlineConfig);
  hooks.registerGlobalHook('_after', 'write', hooksArray, inlineConfig);
  return this;
};

Fortune.prototype.beforeAllRead = GlobalHook('_before', 'read');
Fortune.prototype.beforeAllWrite = Fortune.prototype.beforeAll = GlobalHook('_before', 'write');
Fortune.prototype.afterAllRead = Fortune.prototype.afterAll = GlobalHook('_after', 'read');
Fortune.prototype.afterAllWrite = GlobalHook('_after', 'write');

Fortune.prototype.beforeRW = function(name, hooksArray, inlineConfig){
  this.beforeRead(name, hooksArray, inlineConfig);
  this.beforeWrite(name, hooksArray, inlineConfig);
  return this;
};
Fortune.prototype.afterRW = function(name, hooksArray, inlineConfig){
  this.afterRead.call(this, name, hooksArray, inlineConfig);
  this.afterWrite.call(this, name, hooksArray, inlineConfig);
  return this;
};

Fortune.prototype.beforeRead = Hook('_before', 'read');
Fortune.prototype.beforeWrite = Hook('_before', 'write');
Fortune.prototype.afterRead = Hook('_after', 'read');
Fortune.prototype.afterWrite = Hook('_after', 'write');

function GlobalHook(time, type){
  return function(hooksArray, config){
    hooks.registerGlobalHook(time, type, hooksArray, config);
    return this;
  }
}

function Hook(time, type){

  return function(name, hooksArray, inlineConfig){
    var that = this;
    if (this.options.throwOnLegacyTransforms && (_.isFunction(name) || _.isFunction(hooksArray))){
      throw new Error('You use legacy transforms somewhere');
    }

    if (!_.isString(name)){
      if (_.isArray(name) || _.isFunction(name)){
        inlineConfig = hooksArray;
        hooksArray = name;
      }
      hooksArray = name;
      name = this._resource;
    }
    hooks.addHook.call(that, name, hooksArray, time, type, inlineConfig);
    return this;
  }
}

Fortune.prototype.before = function(name, fn){
  if (typeof name !== 'string') {
    fn = name;
    name = this._resource;
  }
  var that = this;
  hooks.addHook.call(that, name, fn, '_before', 'write');
  return this;
};

Fortune.prototype.after = function(name, fn){
  if (typeof name !== 'string') {
    fn = name;
    name = this._resource;
  }
  var that = this;
  hooks.addHook.call(that, name, fn, '_after', 'read');
  return this;
};

/**
 * @deprecated Hooks provide more flexible interface
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
  var that = this;
  hooks.addHook.call(that, name, before, '_before', 'write');
  hooks.addHook.call(that, name, after, '_after', 'read');
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

Fortune.prototype._querytree = null;

/**
 * Keep track of the last added resource so that we can
 * chain methods that act on resources.
 *
 * @api private
 */
Fortune.prototype._resource = '';

/**
 * Ready state helpers
 * @type {boolean}
 * @api private
 */
Fortune.prototype._ready = false;
Fortune.prototype._resourcesStarted = 0;


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
