var Serializer = require('./')
var DefaultSerializer = require('./default')
var castValue = require('./cast_value')
var methods = require('../common/methods')
var keys = require('../common/keys')

var errors = require('../common/errors')
var UnsupportedError = errors.UnsupportedError
var NotAcceptableError = errors.NotAcceptableError
var BadRequestError = errors.BadRequestError
var nativeErrors = errors.nativeErrors

var classMethods = Object.keys(Serializer.prototype)
var inputMethods = {
  parseCreate: true,
  parseUpdate: true
}


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
function SerializerSingleton (properties) {
  var self = this
  var serializers = properties.serializers || []
  var ids = []
  var types = Object.create(null)
  var i, j, k, type, CustomSerializer, id

  self.constructor(properties)

  for (i = 0, k = serializers.length; i < k; i++) {
    j = serializers[i]
    type = j.type

    if (typeof type !== 'function')
      throw new TypeError('The serializer must be a function or class.')

    CustomSerializer = Serializer.prototype
      .isPrototypeOf(type.prototype) ? type : type(Serializer)

    if (!Serializer.prototype.isPrototypeOf(CustomSerializer.prototype))
      throw new TypeError(
        'The serializer must be a class that extends Serializer.')

    id = CustomSerializer.id

    if (!id) throw new Error(
      'The serializer must have a static property named "id".')

    ids.push(id)

    types[id] = new CustomSerializer({
      options: j.options || Object.create(null),
      recordTypes: properties.recordTypes,
      adapter: properties.adapter,
      castValue: castValue,
      errors: errors,
      methods: methods,
      keys: keys
    })
  }

  Object.defineProperties(self, {

    // Internal property to keep instances of serializers.
    types: { value: types },

    // Internal instance of the default serializer.
    defaultSerializer: {
      value: new DefaultSerializer({
        recordTypes: properties.recordTypes,
        errors: errors
      })
    },

    // Array of IDs ordered by priority.
    ids: { value: ids }

  })

  // Assign the proxy methods on top of the base methods.
  for (i = classMethods.length; i--;) {
    j = classMethods[i]
    if (j === 'constructor') continue
    self[j] = curryProxyMethod(self, j)
  }
}


// Currying internal proxy method.
function curryProxyMethod (scope, method) {
  return function (context, a, b) {
    return proxyMethod(scope, {
      method: method,
      isInput: inputMethods[method]
    }, context, a, b)
  }
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (scope, options, context, a, b) {
  var types = scope.types
  var isInput = options.isInput
  var format = context.request[isInput ?
    'serializerInput' : 'serializerOutput']
  var serializer = types[format]
  var NoopError = isInput ? UnsupportedError : NotAcceptableError
  var error

  // Fall back to default serializer.
  if (!format) serializer = scope.defaultSerializer

  // Fail if no serializer was found.
  if (!serializer)
    return Promise.reject(new NoopError(
      'The serializer for "' + format + '" is unrecognized.'))

  try {
    return Promise.resolve(serializer[options.method](context, a, b))
  }
  catch (e) {
    error = e

    // Only in the special case of input methods, it may be more appropriate to
    // throw a BadRequestError.
    if (~nativeErrors.indexOf(error.constructor) && isInput)
      error = new BadRequestError('The request is malformed.')

    return Promise.reject(error)
  }
}


SerializerSingleton.prototype = Object.create(Serializer.prototype)


module.exports = SerializerSingleton
