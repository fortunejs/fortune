// system dependencies
import http from 'http';

// local modules
import Parser from './schemas/parser';
import {AdapterProxy} from './adapter';
import {SerializerProxy} from './serializer';
import {RouterProxy} from './new_router';

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
   *   // A hash that maps names to a serializer. Typically, the names should
   *   // be informative, such as a `Content-Type` for HTTP.
   *   // Default: {'application/vnd.api+json': {type: { ... }, options: {}}}
   *   serializer: {
   *     'application/vnd.api+json': {
   *       // May be an object or class that implements the
   *       // serializer methods. Required.
   *       type: { ... },
   *
   *       // An options object that is specific to the serializer.
   *       // Default: {}
   *       options: { ... }
   *     }
   *   }
   * }
   *
   * router: {
   *   // Whether or not to pluralize resource names in the router.
   *   // Default: true
   *   inflect: true
   *
   *   // Add a prefix to links. Useful for mounting under a path.
   *   // Default: ''
   *   prefix: ''
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

    this.adapter = new AdapterProxy(this);
    this.serializer = new SerializerProxy(this);
    this.router = new RouterProxy(this);
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
   * @param {String} name name of the resource
   * @param {Object} schema schema object
   * @param {Object} [options] additional options
   * @return this
   */
  resource (name) {
    var schemas = this.schemas;

    if (!name.length) {
      return console.warn('Resource must have a non-trivial name.');
    }

    if (!!this._initialized) {
      return console.warn('Cannot define new resources after initialization.');
    }

    // Memoize the current name, for chaining methods.
    this._currentResource = name;

    if (!schemas.hasOwnProperty(name)) {
      schemas[name] = Parser.apply(null, arguments);
    } else {
      console.warn('The resource "' + name + '" was already defined.');
    }

    return this;
  }


  /**
   * Define a transform on a resource.
   *
   * The context of a transform function is an individual resource, and takes
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
   * @param {String} [name]
   * @param {Function} [before]
   * @param {Function} [after]
   * @return this
   */
  transform (name, before, after) {
    var transforms = this.transforms;
    var schemas = this.schemas;

    if (typeof name !== 'string') {
      before = arguments[0];
      after = arguments[1];
      name = this._currentResource;
    }

    if (schemas.hasOwnProperty(name)) {
      transforms[name] = {};

      if (typeof before === 'function') {
        transforms[name].before = before;
      }
      if (typeof after === 'function') {
        transforms[name].after = after;
      }

    } else {
      console.warn('Attempted to define transform on "' + name +
        '" resource which does not exist.');
    }

    return this;
  }


  /**
   * Convenience method to define only the `before` argument of a transform.
   *
   * @param {String} [name]
   * @param {Function} fn
   * @return this
   */
  before (name, fn) {
    return this.transform.call(this, name, fn, null);
  }


  /**
   * Convenience method to define only the `after` argument of a transform.
   *
   * @param {String} [name]
   * @param {Function} after
   * @return this
   */
  after (name, fn) {
    return this.transform.call(this, name, null, fn);
  }


  /**
   * Create an server instance and listen on the specified port. This method
   * is just for convenience, what it does is call `http.createServer` and
   * `listen` subsequently. The parameters for this method are identical to
   * that of Node's `http.listen` method.
   */
  listen () {
    if (!this._initialized) {
      return console.warn('The `init` method must be called first.');
    }

    var server = http.createServer(function(){});
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

  if (!('serializer' in options)) {
    defaults.serializer = {
      'application/vnd.api+json': {
        type: jsonApiSerializer,
        options: {
          spaces: 2
        }
      }
    };
  }

  return Object.assign(defaults, options);
}
