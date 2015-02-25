import Serializer from './';
import excludedKeys from '../common/excluded_keys';
import enumerateMethods from '../common/enumerate_methods';
import * as Errors from '../common/errors';

const inputMethods = {
  parseCreate: true,
  parseUpdate: true
};


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (context) {
    let serializers = context.options.serializers || [];
    let types = serializers.reduce((types, serializer) => {
      let type = serializer.type;

      // Coerce a constructor function into its prototype.
      if (typeof type === 'function')
        type = enumerateMethods(type);

      types[serializer.id] = new Serializer(Object.assign(type, {
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

    // Private property to keep instances of serializers.
    Object.defineProperty(this, '_types', {
      value: types
    });
  }

}


// Assign the proxy methods on top of the base methods.
Object.assign(SerializerSingleton.prototype,
  Object.getOwnPropertyNames(Serializer.prototype).reduce((proxy, method) => {

    proxy[method] = method in inputMethods ?
      // Input method proxy.
      function (context) {
        let format = context.request.serializerInput;
        if (format in this._types) {
          try {
            return this._types[format][method](...arguments);
          } catch (error) {
            throw new Errors.BadRequestError(
              `The request was not well-formed.`);
          }
        }

        if (!format)
          throw new Errors.UnsupportedError(
            `A type was not specified for the input format.`);

        throw new Errors.UnsupportedError(`The type "${format}" ` +
          `is unrecognized.`);
      } :
      // Output method proxy.
      function (context) {
        let format = context.request.serializerOutput;
        if (format in this._types) {
          try {
            return this._types[format][method](...arguments);
          } catch (error) {
            throw new Error(
              `There was an error processing the response.`);
          }
        }

        if (!format)
          throw new Errors.UnsupportedError(
            `A type was not specified for the output format.`);

        throw new Errors.NotAcceptableError(`The type "${format}" ` +
          `is unrecognized.`);
      };

    return proxy;
  }, {}));
