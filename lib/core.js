// system dependencies
import http from 'http';

// local modules
import Parser from './schemas/parser';
import AdapterSingleton from './singletons/adapter_singleton';
import SerializerSingleton from './singletons/serializer_singleton';
import RouterSingleton from './singletons/router_singleton';

// defaults
import nedbAdapter from './adapters/nedb';
import jsonApiSerializer from './serializers/json_api';


export default class Core {

  /**
   * Create a new instance. The options object may be as follows:
   *
   * ```js
   * {
   *   // Storage adapter configuration.
   *   adapter: {
   *     // May be an object or class that implements the
   *     // adapter methods. Required.
   *     // Default: NeDB
   *     type: { ... },
   *
   *     // An options object that is specific to the adapter.
   *     // Default: {}
   *     options: {}
   *   },
   *
   *   // An array of objects ordered by priority.
   *   // Default: [{id: 'application/vnd.api+json',
   *   // type: jsonApiSerializer, options: { spaces: 2 }}]
   *   serializers: [{
   *     // The ID should be informative and unique, such as corresponding
   *     // to a `Content-Type` for HTTP.
   *     id: 'application/vnd.api+json',
   *
   *     // May be an object or class that implements the
   *     // serializer methods. Required.
   *     type: { ... },
   *
   *     // An options object that is specific to the serializer.
   *     // Default: {}
   *     options: { ... }
   *   }],
   *
   *   router: {
   *     // Whether or not to pluralize names of resources.
   *     // Default: true
   *     inflect: true
   *
   *     // Add a prefix to links. Useful for mounting under a path.
   *     // Default: ''
   *     prefix: ''
   *   }
   * }
   * ```
   *
   * @param {Object} options
   */
  constructor (options = {}) {
    // Force instantiation if constructor is called directly.
    if (!(this instanceof Core)) return new Core(options);

    this._initialized = false;

    this.options = setDefaults(options);
    this.schemas = {};
    this.transforms = {};

    this.adapter = new AdapterSingleton(this);
    this.serializer = new SerializerSingleton(this);
    this.router = new RouterSingleton(this);
  }


  /**
   * Init method, which is mainly a proxy for the adapter's init method.
   * Prevents resources from being defined after this method is called.
   *
   * @return {Promise}
   */
  init () {
    if (!!this._initialized) {
      return console.warn('The `init` method should only be called once.');
    } else {
      this._initialized = true;
      return this.adapter.init();
    }
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
  resource (type) {
    if (!type.length) {
      return console.warn('Resource must have a non-trivial name.');
    }

    if (!!this._initialized) {
      return console.warn('Cannot define new resources after initialization.');
    }

    // Memoize the current type, for chaining methods.
    this._currentResource = type;

    if (!(type in this.schemas)) {
      this.schemas[type] = Parser.apply(null, arguments);
    } else {
      console.warn('The resource "' + type + '" was already defined.');
    }

    return this;
  }


  /**
   * Define a transform on a resource type.
   *
   * The context of a transform function is an individual entity, and takes
   * two arguments, the `request` and `response` from Node.
   *
   * A transform has two parts, before it is written to, and after it is read
   * from the data store, neither are required. It must yield or return the
   * context `this` either synchronously or asynchronously as a Promise. If
   * an error occurs within an transform function, it will be forwarded to
   * the client.
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
      return console.warn('A function must be passed to transform.');

    if (type in this.schemas) {
      this.transforms[type] = {};

      if (typeof before === 'function')
        this.transforms[type].before = before;

      if (typeof after === 'function')
        this.transforms[type].after = after;

    } else {
      console.warn('Attempted to define transform on "' + type +
        '" resource which does not exist.');
    }

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


  /**
   * Create an server instance and listen on the specified port. This method
   * is just for convenience, what it does is call `http.createServer` and
   * `listen` subsequently. The parameters for this method are identical to
   * that of Node's `http.listen` method.
   */
  listen () {
    if (!this._initialized)
      return console.warn('The `init` method must be called first.');

    let server = http.createServer(function(){});
    server.listen.apply(server, arguments);
    return server;
  }

}


/*!
 * Default settings.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options) {
  const defaults = {
    router: {
      inflect: true,
      prefix: ''
    }
  };

  if (!('adapter' in options)) {
    defaults.adapter = {
      type: nedbAdapter,
      options: {
        name: 'db',
        inMemoryOnly: true
      }
    };
  }

  if (!('serializers' in options)) {
    defaults.serializers = [{
      id: 'application/vnd.api+json',
      type: jsonApiSerializer,
      options: {
        spaces: 2
      }
    }];
  }

  return Object.assign(defaults, options);
}
