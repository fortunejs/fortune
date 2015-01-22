import Serializer from '../serializer';

/**
 * Proxy the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerProxy extends Serializer {

  constructor (context) {
    this._types = {};

    for (let type in context.options.serializer) {
      let serializer = context.options.serializer[type].type;

      // Coerce a constructor function into its prototype.
      if (typeof serializer === 'function')
        serializer = serializer.prototype;

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
    proxy[method] = method.indexOf('parse') === 0 ? function (context) {
      return this._types[context.request.serializerInput]
        [method](...arguments);
    } : function (context) {
      return this._types[context.request.serializerOutput]
        [method](...arguments);
    };

    return proxy;

  }, {}));
