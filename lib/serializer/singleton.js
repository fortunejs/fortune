import Serializer from './'
import * as keys from '../common/reserved_keys'
import * as errors from '../common/errors'
import * as events from '../common/events'


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (core) {
    super()

    const types = core.options.serializers.reduce((types, serializer) => {
      let CustomSerializer
      const { type, options } = serializer
      const { schemas, adapter } = core

      if (typeof type !== 'function')
        throw new TypeError(`The serializer must be a function or class.`)

      CustomSerializer = type

      // Check if it's a class or a dependency injection function.
      try { CustomSerializer = CustomSerializer(Serializer) }
      catch (error) { if (!(error instanceof TypeError)) throw error }

      if (Object.getPrototypeOf(CustomSerializer) !== Serializer)
        throw new TypeError(`The serializer must be a class ` +
          `that extends Serializer.`)

      if (!CustomSerializer.hasOwnProperty('id'))
        throw new Error(`The serializer must have a static property ` +
          `named "id".`)

      types[CustomSerializer.id] = new CustomSerializer({
        events, keys, errors, options, schemas, adapter
      })

      return types
    }, {})

    // Internal property to keep instances of serializers.
    Object.defineProperty(this, 'types', {
      value: types
    })

    assignSerializerProxy.call(this)
  }

}


const inputMethods = [ 'parseCreate', 'parseUpdate' ]


// Assign the proxy methods on top of the base methods.
function assignSerializerProxy () {
  const prototype = Object.getPrototypeOf(this)
  const methods = Object.getOwnPropertyNames(Serializer.prototype)
    .filter(name => name !== 'constructor')

  Object.assign(prototype, methods.reduce((proxy, method) => {
    const isInput = !!~inputMethods.indexOf(method)

    proxy[method] = proxyMethod.bind(this, {
      method,
      isInput,
      methodError: isInput ?
        errors.BadRequestError : Error,
      noopError: isInput ?
        errors.UnsupportedError : errors.NotAcceptableError
    })

    return proxy
  }, {}))
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (options, context, ...args) {
  const { types } = this
  const [ MethodError, NoopError ] = [ options.methodError, options.noopError ]
  const format = context.request[options.isInput ?
    'serializerInput' : 'serializerOutput']

  if (types.hasOwnProperty(format))
    try {
      return types[format][options.method](context, ...args)
    } catch (error) {
      throw new MethodError(options.isInput ?
        `The request was not well-formed.` :
        `There was an error processing the response.`)
    }

  if (!format)
    throw new NoopError(`A type was not specified for the ` +
      `${options.isInput ? 'input' : 'output'} format.`)

  throw new NoopError(`The type "${format}" ` +
    `is unrecognized.`)
}
