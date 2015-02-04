import Serializer from './';
import excludedKeys from '../common/excluded_keys';
import enumerateMethods from '../common/enumerate_methods';
import * as Errors from '../common/errors';

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
        type = enumerateMethods(type);

      types[serializer.id] = new Serializer(
        Object.assign(type, {
          options: serializer.options || {},
          schemas: context.schemas
        }, {
          options: {
            // This gives us generic options merged into the
            // serializer's options under the `generic` key.
            generic: Object.keys(context.options).reduce((options, key) => {
              if (!(key in excludedKeys))
                options[key] = context.options[key];
              return options;
            }, {})
          }
        }));

      return types;
    }, {});
  }

}

let inputMethods = {
  parseCreate: true,
  parseUpdate: true
};

// Assign the proxy methods on top of the base methods.
Object.assign(SerializerSingleton.prototype,
  Object.keys(Serializer.prototype).reduce((proxy, method) => {

    proxy[method] = method in inputMethods ?
      // Input method proxy.
      function (context) {
        let format = context.request.serializerInput;
        if (format in this._types) {
          try {
            return this._types[format][method](...arguments);
          } catch (error) {
            throw new Errors.BadRequestError(
              'The request was not well-formed.');
          }
        } else if (!format) {
          throw new Errors.UnsupportedError(
            'A content type was not specified.');
        } else {
          throw new Errors.UnsupportedError('The content type "' + format +
            ' is unrecognized.');
        }
      } :
      // Output method proxy.
      function (context) {
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
