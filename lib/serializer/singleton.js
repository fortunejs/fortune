import Serializer from './'
import * as arrayProxy from '../common/array_proxy'
import * as keys from '../common/reserved_keys'
import * as errors from '../common/errors'
import * as methods from '../common/methods'


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (dependencies) {
    super()

    const { schemas, adapter } = dependencies
    const ids = []
    const types = dependencies.serializers.reduce((types, serializer) => {
      const { type } = serializer

      if (typeof type !== 'function')
        throw new TypeError(`The serializer must be a function or class.`)

      let CustomSerializer = type

      // Check if it's a class or a dependency injection function.
      try { CustomSerializer = CustomSerializer(Serializer) }
      catch (error) { if (!(error instanceof TypeError)) throw error }

      if (Object.getPrototypeOf(CustomSerializer) !== Serializer)
        throw new TypeError(`The serializer must be a class ` +
          `that extends Serializer.`)

      if (!CustomSerializer.hasOwnProperty('id'))
        throw new Error(`The serializer must have a static property ` +
          `named "id".`)

      ids.push(CustomSerializer.id)

      types[CustomSerializer.id] = new CustomSerializer({
        options: serializer.options || {},
        methods, keys, errors, schemas, adapter
      })

      return types
    }, {})

    Object.defineProperties(this, {

      // Internal property to keep instances of serializers.
      types: { value: types },

      // Internal instance of the default serializer.
      defaultSerializer: { value: new Serializer({ schemas, errors }) },

      // Array of IDs ordered by priority.
      ids: { value: ids }

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
    const isInput = arrayProxy.includes(inputMethods, method)

    proxy[method] = proxyMethod.bind(this, {
      method,
      isInput,
      NoopError: isInput ?
        errors.UnsupportedError : errors.NotAcceptableError
    })

    return proxy
  }, {}))
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (options, context, ...args) {
  const { types, defaultSerializer } = this
  const { NoopError } = options
  const format = context.request[options.isInput ?
    'serializerInput' : 'serializerOutput']
  let serializer

  // If a serializer is specified, use it.
  if (types.hasOwnProperty(format)) serializer = types[format]

  // Fall back to default serializer.
  else if (!format) serializer = defaultSerializer

  if (serializer)
    return serializer[options.method](context, ...args)

  throw new NoopError(`The serializer for "${format}" ` +
    `is unrecognized.`)
}
