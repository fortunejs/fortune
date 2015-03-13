import Serializer from './';
import * as errors from '../common/errors';


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (core) {
    let serializers = core.options.serializers || [];
    let types = serializers.reduce((types, serializer) => {
      let type = serializer.type;

      if (typeof type === 'function' && !type.prototype)
        type = type(Serializer);

      if (!type.prototype ||
        Object.getPrototypeOf(type.prototype) !== Serializer.prototype)
        throw new Error(`The "type" must be a class ` +
          `that extends Serializer.`);

      types[serializer.id] = new type(Object.assign({
        options: serializer.options || {},
        schemas: core.schemas
      }));

      return types;
    }, {});

    // Internal property to keep instances of serializers.
    Object.defineProperty(this, '_types', {
      value: types
    });

    assignSerializerProxy.call(this);
  }

}


// Assign the proxy methods on top of the base methods.
function assignSerializerProxy () {
  const inputMethods = [
    'parseCreate',
    'parseUpdate'
  ];

  let prototype = Object.getPrototypeOf(this);
  let methods = Object.getOwnPropertyNames(Serializer.prototype)
    .filter(name => name !== 'constructor');

  Object.assign(prototype, methods.reduce((proxy, method) => {
    let isInput = !!~inputMethods.indexOf(method);

    proxy[method] = proxyMethod.bind(this, {
      method,
      isInput,
      methodError: isInput ?
        errors.BadRequestError : Error,
      noopError: isInput ?
        errors.UnsupportedError : errors.NotAcceptableError
    });

    return proxy;
  }, {}));
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (options, context, ...args) {
  let format = context.request[options.isInput ?
    'serializerInput' : 'serializerOutput'];

  if (format in this._types) {
    try {
      return this._types[format][options.method](context, ...args);
    } catch (error) {
      throw new options.methodError(options.isInput ?
        `The request was not well-formed.` :
        `There was an error processing the response.`);
    }
  }

  if (!format)
    throw new options.noopError(`A type was not specified for the ` +
      `${options.isInput ? 'input' : 'output'} format.`);

  throw new options.noopError(`The type "${format}" ` +
    `is unrecognized.`);
}
