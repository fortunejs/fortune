import Serializer from './'
import DefaultSerializer from './default'
import * as keys from '../common/keys'
import * as errors from '../common/errors'
import * as methods from '../common/methods'


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (dependencies) {
    super()

    const { recordTypes, adapter, serializers } = dependencies
    const ids = []
    const types = serializers ? serializers.reduce((types, serializer) => {
      let { type } = serializer

      if (typeof type !== 'function')
        throw new TypeError(`The serializer must be a function or class.`)

      // Check if it's a class or a dependency injection function.
      try { type = type(Serializer) }
      catch (error) { if (!(error instanceof TypeError)) throw error }

      const CustomSerializer = type

      let prototype = CustomSerializer
      while (prototype !== null) {
        prototype = Object.getPrototypeOf(prototype)
        if (prototype === Serializer) break
      }

      if (prototype !== Serializer)
        throw new TypeError(`The serializer must be a class ` +
          `that extends Serializer.`)

      const { id } = CustomSerializer

      if (!id)
        throw new Error(`The serializer must have a static property ` +
          `named "id".`)

      ids.push(id)

      types[id] = new CustomSerializer({
        options: serializer.options || {},
        methods, keys, errors, recordTypes, adapter
      })

      return types
    }, {}) : {}

    Object.defineProperties(this, {

      // Internal property to keep instances of serializers.
      types: { value: types },

      // Internal instance of the default serializer.
      defaultSerializer: {
        value: new DefaultSerializer({ recordTypes, errors })
      },

      // Array of IDs ordered by priority.
      ids: { value: ids }

    })

    assignSerializerProxy.call(this)
  }

}


const inputMethods = new Set([ 'parseCreate', 'parseUpdate' ])


// Assign the proxy methods on top of the base methods.
function assignSerializerProxy () {
  const prototype = Object.getPrototypeOf(this)
  const methods = Object.getOwnPropertyNames(Serializer.prototype)
    .filter(name => name !== 'constructor')

  Object.assign(prototype, methods.reduce((proxy, method) => {
    const isInput = inputMethods.has(method)

    proxy[method] = proxyMethod.bind(this, {
      method, isInput,
      NoopError: isInput ?
        errors.UnsupportedError : errors.NotAcceptableError
    })

    return proxy
  }, {}))
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (options, context, ...args) {
  const { types, defaultSerializer } = this
  const { NoopError, isInput, method } = options
  const format = context.request[isInput ?
    'serializerInput' : 'serializerOutput']
  let serializer

  // If a serializer is specified, use it.
  if (format in types) serializer = types[format]

  // Fall back to default serializer.
  else if (!format) serializer = defaultSerializer

  // Fail if no serializer was found.
  else throw new NoopError(`The serializer for "${format}" is unrecognized.`)

  try {
    return serializer[method](context, ...args)
  }
  catch (error) {
    if (!isInput) throw error

    let isNative = false

    for (let nativeError of errors.nativeErrors)
      if (error.constructor === nativeError) {
        isNative = true
        break
      }

    if (isNative)
      throw new errors.BadRequestError(`The request is malformed.`)

    throw error
  }
}
