import {empty as noop} from './utils/noop';


/**
 * Serializer is a class containing methods to be implemented. All of its
 * methods **must** be synchronous, no promises or callbacks, it has to
 * be fast/blocking. Serializer methods can be categorized into two main
 * categories: showing (deserializing) or parsing (serializing). Generally
 * all of its methods should be implemented, except for certain formats
 * which may be read-only, such as JSON Patch. All of the methods take
 * the `context` object as the first parameter.
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
   * Show error(s). This method should mutate the state of the context
   * and it does not need to return anything, but should mutate
   * `context.response`.
   *
   * @param {Object} context
   * @param {Object|Array} errors should be of Error class.
   */
  showError () {
    return noop();
  }

}


/**
 * Proxy the publicly accessed methods of the serializer to an underlying
 * serializer matching the context.
 */
export class SerializerProxy extends Serializer {

  constructor (context) {
    this._types = {};

    for (let type in context.options.serializer) {
      let serializer = context.options.serializer[type].type;

      // Coerce a constructor function into its prototype.
      if (typeof serializer === 'function') {
        serializer = serializer.prototype;
      }

      this._types[type] = new Serializer(
        Object.assign(serializer, {
          options: context.options.serializer[type].options || {},
          schemas: context.schemas
        }, {
          options: {
            // This gives us options from the router merged into the
            // serializer's options under the `router` key.
            router: context.options.router
          }
        }));
    }
  }

}


// Assign the proxy methods on top of the base methods.
Object.assign(SerializerProxy.prototype,
  Object.keys(Serializer.prototype).reduce((proxy, method) => {
    // If the method name starts with `parse`, it's an input.
    proxy[method] = method.indexOf('parse') === 0 ?
      function (context) {
        return this._types[context.request.serializerInput]
          [method](...arguments);
      } : function (context) {
        return this._types[context.request.serializerOutput]
          [method](...arguments);
      };
    return proxy;
  }, {}));
