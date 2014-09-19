// local modules
var schemaParser = require('./schemas/parser');


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
 *   important_dates: {type: [Date]},
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
 * Define a transform function, which must be a generator, or a function that
 * returns an iterator. Only one transform can be applied per resource.
 *
 * The context of a transform is an individual resource.
 *
 * @param {String} [name]
 * @param {Function} fn must be a generator or return an iterator
 * @return this
 */
Fortune.prototype.transform = function (name, fn) {
  var transforms = this.transforms;

  if (typeof name !== 'string') {
    fn = name;
    name = this._currentResource;
  }

  transforms[name] = fn;

  return this;
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
