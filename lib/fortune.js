// local modules
var schemaParser = require('./schemas/parser');
var Adapter = require('./adapter');
var Serializer = require('./serializer');
var Router = require('./router');

module.exports = function (options) {
  return new Fortune(options);
};


/**
 * Create an instance of Fortune.
 *
 * @param {Object} options
 */
function Fortune () {
  this.init.apply(this, arguments);
}


/*!
 * Init method.
 */
Fortune.prototype.init = function () {
  this.options = setDefaults.apply(null, arguments);

  this.schemas = {};
  this.transforms = {};

  this.adapter = new Adapter(this.options);
  this.serializer = new Serializer(this.options);
  this.router = new Router(this.options);
};


/**
 * Define a resource given a schema definition and database options.
 * The `schema` object only serves to enforce data types, and does not handle
 * any validation. Here are some example fields of the `schema` object:
 *
 * ```js
 * {
 *   // equivalent, a singular value
 *   first_name: String,
 *   last_name: 'string',
 *   nickname: {type: String},
 *
 *   // equivalent, an array containing values of a single type
 *   lucky_numbers: [Number],
 *   unlucky_numbers: {type: ['number']},
 *   important_numbers: {type: [Number]},
 *
 *   // links to other resources
 *   pets: {link: ['animal'], inverse: 'owner'} // creates a to-many link to 'animal' resource
 *   secret: {link: 'secret', inverse: null} // creates a to-one link with no bi-directionality
 *
 *   // not allowed
 *   things: [Object, String] // polymorphic types not allowed
 *   nested: {
 *     thing: String // nested schema fields not allowed, except for Object type
 *   }
 * }
 * ```
 *
 * The allowed native types are `String`, `Number`, `Boolean`, `Date`, `Object`,
 * `Array`, `Buffer`. Note that buffers will be stored as binary data internally,
 * but are expected to be Base64 encoded over HTTP.
 *
 * An optional `options` object may also be passed, which is used mainly
 * for specifying options for the database. Currently, the only supported
 * option is indexing. For example:
 *
 * ```js
 * {
 *    index: {}
 * }
 * ```
 *
 * @param {String} name name of the resource
 * @param {Object} schema schema object
 * @param {Object} [options] additional options
 * @return this
 */
Fortune.prototype.resource = function (name) {
  var schemas = this.schemas;

  this._currentResource = name;

  if (!schemas.hasOwnProperty(name)) {
    schemas[name] = schemaParser.apply(null, arguments);
  } else {
    console.warn('The resource "' + name + '" was already defined.');
  }

  return this;
};


/**
 * Define a transform on a resource.
 *
 * The context of a transform function is an individual resource, and takes
 * two arguments, the `request` and `response` from Node. These arguments may
 * not always be present, in case the protocol is not HTTP.
 *
 * A transform has two parts, before it is written to, and after it is read
 * from the data store, neither are required. It must yield or return the
 * context `this` either synchronously or asynchronously as a Promise. If
 * an error occurs within an transform function, it will be forwarded to the
 * client.
 *
 * An example transform to apply a timestamp on a resource before writing,
 * and displaying the timestamp in the server's locale:
 *
 * ```js
 * app.transform(function () {
 *   this.timestamp = new Date();
 *   return this;
 * }, function () {
 *   this.timestamp = this.timestamp.toLocaleString();
 *   return this;
 * });
 * ```
 *
 * @param {String} [name]
 * @param {Function} [before]
 * @param {Function} [after]
 * @return this
 */
Fortune.prototype.transform = function (name, before, after) {
  var transforms = this.transforms;
  var schemas = this.schemas;

  if (typeof name !== 'string') {
    before = arguments[0];
    after = arguments[1];
    name = this._currentResource;
  }

  if (schemas.hasOwnProperty(name)) {
    transforms[name] = {};

    if (!!before && typeof before === 'function') {
      transforms[name].before = before;
    }
    if (!!after && typeof after === 'function') {
      transforms[name].after = after;
    }

  } else {
    console.warn('Attempted to define transform on "' + name +
      '" resource which does not exist.');
  }

  return this;
};


/**
 * Convenience method to define only the `before` argument of a transform.
 *
 * @param {String} [name]
 * @param {Function} before
 * @return this
 */
Fortune.prototype.before = function (name, before) {
  return this.transform.call(this, name, before, null);
};


/**
 * Convenience method to define only the `after` argument of a transform.
 *
 * @param {String} [name]
 * @param {Function} after
 * @return this
 */
Fortune.prototype.after = function (name, after) {
  return this.transform.call(this, name, null, after);
};


/*!
 * Default settings.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options) {
  var defaults = {

  };
  var key;

  for (key in options) {
    defaults[key] = options[key];
  }

  return defaults;
}
