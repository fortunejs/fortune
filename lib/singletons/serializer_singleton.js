import Serializer from '../serializer';
import * as Errors from '../utils/errors';

/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (context) {
    let serializers = context.options.serializers || [];

    this._types = serializers.reduce((types, serializer) => {
      let type = serializer.type;

      // Coerce a constructor function into its prototype.
      if (typeof type === 'function')
        type = type.prototype;

      types[serializer.id] = new Serializer(
        Object.assign(type, {
          options: serializer.options || {},
          schemas: context.schemas
        }, {
          options: {
            // This gives us options from the router merged into the
            // serializer's options under the `router` key.
            router: context.options.router
          }
        }));

      return types;
    }, {});
  }

}


// Assign the proxy methods on top of the base methods.
Object.assign(SerializerSingleton.prototype,
  Object.keys(Serializer.prototype).reduce((proxy, method) => {

    // If the method name starts with `parse`, it's an input.
    proxy[method] = method.indexOf('parse') === 0 ? function (context) {
      let format = context.request.serializerInput;
      if (format in this._types) {
        try {
          return this._types[format][method](...arguments);
        } catch (error) {
          throw new Errors.BadRequestError('The request was not well-formed.');
        }
      } else if (!format) {
        throw new Errors.UnsupportedError('A content type was not specified.');
      } else {
        throw new Errors.UnsupportedError('The content type "' + format +
          ' is unrecognized.');
      }
    } : function (context) {
      let format = context.request.serializerOutput;
      if (format in this._types) {
        return this._types[format][method](...arguments);
      } else {
        throw new Errors.NotAcceptableError('The content type "' + format +
          ' is unrecognized.');
      }
    };

    return proxy;

  }, {}));
