import {empty as noop} from './utils/noop';


/**
 * Serializer is a class containing methods to be implemented. All of its
 * methods **must** be synchronous, no promises or callbacks, it has to
 * be fast/blocking. Serializer methods can be categorized into two main
 * categories: showing (deserializing) or parsing (serializing). Generally
 * all of its methods should be implemented, except for certain formats
 * which may be read-only, such as JSON Patch.
 */
export default class Serializer {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * Show the top-level index, typically a list of links. It does not need
   * to return anything, only mutate `context.response`.
   *
   * @param {Object} context
   */
  showIndex () {
    return noop();
  }

  /**
   * Represent an entity or entities as a resource. The parameter `entities`
   * must follow this format:
   *
   * ```js
   * {
   *   type: [{}, ...]
   * }
   * ```
   *
   * It is keyed by type, and its value is an array of objects. It does
   * not need to return anything, only mutate `context.response`.
   *
   * @param {Object} context
   * @param {Object} entities
   */
  showResource () {
    return noop();
  }

  /**
   * Show errors. This method should mutate the state of the context
   * and it does not need to return anything, but should mutate
   * `context.response`.
   *
   * @param {Object} context
   * @param {Object|Array} errors should be of Error class.
   */
  showErrors () {
    return noop();
  }

}


/**
 * Proxy the publicly accessed methods of the serializer to an underlying
 * serializer matching the context.
 */
export class SerializerProxy extends Serializer {

  constructor (context) {
    this.types = {};

    for (let type in context.options.serializer) {
      let serializer = context.options.serializer[type].type;

      // Try loading modules by name first.
      if (typeof serializer === 'string') {
        try {
          serializer = require('./serializers/' + serializer);
        } catch (error) {
          serializer = require(serializer);
        }
      }

      // Coerce an object into its prototype.
      if (typeof serializer === 'function') {
        serializer = serializer.prototype;
      }

      this.types[type] = new Serializer(
        Object.assign(serializer, {
          options: context.options.serializer[type].options,
          schemas: context.schemas
        }, {
          options: {
            router: context.options.router
          }
        }));
    }
  }

  _proxy (method, ...args) {
    return this.types[args[0].mediaType][method](...args);
  }

}


// Assign the proxy methods on top of the base methods.
Object.assign(SerializerProxy.prototype,
  Object.keys(Serializer.prototype).reduce((proxy, method) => {
    proxy[method] = function () {
      return this._proxy(method, ...arguments);
    };
    return proxy;
  }, {}));
