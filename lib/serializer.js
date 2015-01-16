import {empty as noop} from './utils/noop';


/**
 * Serializer is a class containing methods to be implemented.
 * Its methods **must** be synchronous.
 */
export default class Serializer {

  constructor (context) {
    Object.assign(this, context);
  }


  /**
   * In order for the serializer to be aware of query strings, this
   * method is provided.
   */
  processQuery () {
    return noop();
  }

  /**
   * Show the top-level index.
   */
  showIndex () {
    return noop();
  }

  /**
   * Represent an entity or entities as a resource.
   */
  showResource () {
    return noop();
  }

  /**
   * Show errors.
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
          options: context.options,
          schemas: context.schemas
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
