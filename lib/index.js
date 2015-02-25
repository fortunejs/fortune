// local modules
import AdapterSingleton from './adapter/singleton';
import SerializerSingleton from './serializer/singleton';
import DispatcherSingleton from './dispatcher/singleton';
import parser from './schema/parser';
import stderr from './common/stderr';

// indirect exports
import Adapter from './adapter';
import Serializer from './serializer';
import * as Adapters from './adapter/adapters';
import * as Serializers from './serializer/serializers';
import * as Net from './net';
import * as Schema from './schema';
import * as Errors from './common/errors';


/**
 * The Fortune class has a few properties attached to it that may be useful
 * to access:
 *
 * - `Adapter`: the adapter class
 * - `Adapters`: default adapters
 * - `Seriailzer`: the serializer class
 * - `Serializers`: default serializers
 * - `Net`: network protocol layers
 * - `Schema`: internal schema implementation
 * - `Errors`: custom typed errors
 */
export default class Fortune {

  /**
   * Create a new instance. The options object may be as follows:
   *
   * ```js
   * {
   *   // Storage adapter configuration.
   *   adapter: {
   *     // Must be a class that extends `Fortune.Adapter`. Required.
   *     // Default: NeDB
   *     type: [Adapter],
   *
   *     // An options object that is specific to the adapter.
   *     // Default: {}
   *     options: {}
   *   },
   *
   *   // An array of objects ordered by priority.
   *   // Default: [{id: 'application/vnd.api+json', type: [Serializer]}]
   *   serializers: [{
   *     // The ID should be informative and unique, such as corresponding
   *     // to a `Content-Type` for HTTP.
   *     id: 'application/vnd.api+json',
   *
   *     // Must be a class that extends `Fortune.Serializer`. Required.
   *     type: [Serializer],
   *
   *     // An options object that is specific to the serializer.
   *     // Default: {}
   *     options: { ... }
   *   }],
   *
   *   // Schema-related options.
   *   schema: {
   *     // Typically Buffer types need to be encoded as a string in many
   *     // media types, or this can be set to a falsy value to turn it off.
   *     // Default: 'base64'
   *     bufferEncoding: 'base64',
   *
   *     // For schema-less databases, any field may be valid, but typically
   *     // it's not a good idea to let users store arbitrary fields.
   *     // Default: true
   *     dropArbitraryFields: true
   *   },
   *
   *   // Commonly known as an identifier, this is the name of the
   *   // field on an entity that is unique and identifies it. String only.
   *   // Default: 'id'
   *   primaryKey: 'id',
   *
   *   // This is a hash keyed by type and contains strings that are the
   *   // primary key for that type. This takes precedence over the generic
   *   // primary key setting.
   *   // Default: {}
   *   primaryKeyPerType: { type: 'name' },
   *
   *   // A function that accepts two parameters, `type`, and `entity` object
   *   // to be created, and returns an unique value.
   *   // This function may return a Promise. If this is not specified, then
   *   // ID generation will be left to the specific adapter.
   *   // Default: undefined
   *   generatePrimaryKey: function (type, entity) { ... }
   * }
   * ```
   *
   * @param {Object} options
   */
  constructor (options) {
    // 0 = not started, 1 = started, 2 = done
    Object.defineProperty(this, '_initializationStatus', {
      writable: true,
      value: 0
    });

    this.options = setDefaults(options);
    this.schemas = {};
    this.transforms = {};

    this.adapter = new AdapterSingleton(this);
    this.serializer = new SerializerSingleton(this);
    this.dispatcher = new DispatcherSingleton(this);
  }


  /**
   * Init method, which is mainly a proxy for the adapter's init method.
   * Prevents resources from being defined after this method is called.
   *
   * @return {Promise}
   */
  init () {
    if (this._initializationStatus !== 0)
      return stderr.warn(`The \`init\` method should only be called once.`);

    this._initializationStatus = 1;
    return this.adapter.init().then(() => {
      this._initializationStatus = 2;
      return;
    }, (error) => {
      this._initializationStatus = 0;
      throw error;
    });
  }


  /**
   * Define a resource given a schema definition and database options.
   * The `schema` object only serves to enforce data types, and does do not
   * do anything more, such as validation. Here are some example fields
   * of the `schema` object:
   *
   * ```js
   * {
   *   // Equivalent, a singular value.
   *   first_name: String,
   *   last_name: 'string',
   *   nickname: {type: String},
   *
   *   // Equivalent, an array containing values of a single type.
   *   lucky_numbers: [Number],
   *   unlucky_numbers: {type: ['number']},
   *   important_numbers: {type: [Number]},
   *
   *   // Creates a to-many link to 'animal' resource. If the field `owner`
   *   // on the `animal` type is to-one, this is many-to-one and
   *   // bi-directional.
   *   pets: {link: ['animal'], inverse: 'owner'},
   *
   *   // Creates a to-one link with no bi-directionality.
   *   secret: {link: 'secret', inverse: null},
   *
   *   // This is allowed. `min` and `max` keys are ignored, need to
   *   // introspect the schema to implement validation.
   *   thing: {type: Number, min: 0, max: 100},
   *
   *   // Polymorphic types are not allowed.
   *   things: [Object, String],
   *
   *   // Nested schema fields are not allowed,
   *   // only `Object` type can have nested values.
   *   nested: {
   *     thing: String
   *   }
   * }
   * ```
   *
   * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
   * `Object`, `Array`, `Buffer`. Note that buffers will be stored as binary
   * data internally, but are expected to be Base64 encoded over HTTP.
   *
   * An optional `options` object may also be passed, which is used mainly
   * for specifying options for the database. This is entirely adapter
   * specific.
   *
   * @param {String} type name of the resource
   * @param {Object} schema schema object
   * @param {Object} [options] additional options
   * @return this
   */
  resource (type, schema, options) {
    if (typeof type !== 'string' || !type.length)
      return stderr.warn(`Resource must have a name.`);

    if (typeof schema !== 'object')
      return stderr.warn(`Schema for "${type}" must be an object.`);

    if (this._initializationStatus !== 0)
      return stderr.warn(`Cannot define new resources after initialization.`);

    if (type in this.schemas)
      return stderr.warn(`The resource "${type}" was already defined.`);

    this.schemas[type] = parser(schema, options, type);

    // Memoize the current type, for chaining methods.
    Object.defineProperty(this, '_currentResource', {
      writable: true,
      configurable: true,
      value: type
    });

    return this;
  }


  /**
   * Define a transform on a resource type.
   *
   * A transform function takes two arguments, the internal `context` object
   * and a single `entity`. The before transform may take an additional
   * argument, `update`, if the request is to update an entity.
   *
   * There are two kinds of transform, before it is written to, and after it is
   * read from the data store, either is optional. It must return the second
   * argument `entity` either synchronously, or asynchronously as a Promise. If
   * an error occurs within an transform function, it will be forwarded in
   * the response. Use typed errors to provide the appropriate feedback.
   * It is important to note that `after` transforms are run every time an
   * entity is included in a response, so it should be idempotent.
   *
   * The context of a `before` transform will have values type-casted to match
   * the schema, and the context of an `after` transform should already have
   * values corresponding to the schema types.
   *
   * An example transform to apply a timestamp on a resource before writing,
   * and displaying the timestamp in the server's locale:
   *
   * ```js
   * app.transform((context, entity) => {
   *   entity.timestamp = new Date();
   *   return entity;
   * }, (context, entity) => {
   *   entity.timestamp = entity.timestamp.toLocaleString();
   *   return entity;
   * });
   * ```
   *
   * @param {String} [type]
   * @param {Function} [before]
   * @param {Function} [after]
   * @return this
   */
  transform (type, before, after) {
    if (arguments.length < 3) {
      before = arguments[0];
      after = arguments[1];
      type = this._currentResource;
    }

    if (![before, after].filter(fn => typeof fn === 'function').length)
      return stderr.warn(`A function must be passed to transform.`);

    if (!(type in this.schemas))
      return stderr.warn(`Attempted to define transform on "${type}" ` +
        `resource which does not exist.`);

    this.transforms[type] = {};

    if (typeof before === 'function')
      this.transforms[type].before = before;

    if (typeof after === 'function')
      this.transforms[type].after = after;

    return this;
  }


  /**
   * Convenience method to define only the `before` argument of a transform.
   *
   * @param {String} [type]
   * @param {Function} fn
   * @return this
   */
  before (type, fn) {
    if (arguments.length < 2) {
      fn = type;
      type = this._currentResource;
    }
    return this.transform(type, fn, null);
  }


  /**
   * Convenience method to define only the `after` argument of a transform.
   *
   * @param {String} [type]
   * @param {Function} after
   * @return this
   */
  after (type, fn) {
    if (arguments.length < 2) {
      fn = type;
      type = this._currentResource;
    }
    return this.transform(type, null, fn);
  }

}


// Assign useful things to the default export.
Object.assign(Fortune, {
  Adapter: Adapter,
  Adapters: Adapters,
  Serializer: Serializer,
  Serializers: Serializers,
  Net: Net,
  Errors: Errors,
  Schema: Schema
});


/*!
 * Default settings.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options = {}) {
  var defaults = {
    schema: {
      bufferEncoding: 'base64',
      dropArbitraryFields: true
    },
    primaryKey: 'id',
    primaryKeyPerType: {},
    generatePrimaryKey: undefined
  };

  if (!('adapter' in options)) {
    defaults.adapter = {
      type: Adapters.NeDB
    };
  }

  if (!('serializers' in options) || !options.serializers.length) {
    defaults.serializers = [{
      id: 'application/vnd.api+json',
      type: Serializers.JSON_API
    }];
  }

  return Object.assign(defaults, options);
}
