'use strict'

var EventEmitter = require('events')

// Local modules.
var memoryAdapter = require('./adapter/adapters/memory')
var AdapterSingleton = require('./adapter/singleton')
var SerializerSingleton = require('./serializer/singleton')
var defineEnumerable = require('./common/define_enumerable')
var assign = require('./common/assign')
var validate = require('./record_type/validate')
var ensureTypes = require('./record_type/ensure_types')
var dispatch = require('./dispatch')
var promise = require('./common/promise')
var middlewares = dispatch.middlewares

// Static re-exports.
var Adapter = require('./adapter')
var Serializer = require('./serializer')
var errors = require('./common/errors')
var methods = require('./common/methods')
var message = require('./common/message')
var constants = require('./common/constants')
var change = constants.change

// Local variables.
var plainObject = {}


/**
 * This is the default export of the `fortune` module. The Fortune class
 * subclasses the built-in `EventEmitter` class, and it has a few static
 * properties attached to it that may be useful to access:
 *
 * - `Adapter`: abstract base class for the Adapter.
 * - `adapters`: included adapters, defaults to memory adapter. Note that the
 * browser build also includes `indexedDB` and `webStorage` adapters.
 * - `Serializer`: abstract base class for the Serializer.
 * - `serializers`: included serializers, defaulting to *ad hoc* HTTP.
 * Server-side only.
 * - `net`: network protocol helpers, currently only HTTP is included.
 * Server-side only.
 * - `errors`: custom typed errors, useful for throwing errors in transform
 * functions.
 * - `methods`: a hash that maps to string constants. Available are: `find`,
 * `create`, `update`, and `delete`.
 * - `change`: this is the name for the event that is emitted when a change
 * is done. The callback function receives an object keyed by method names.
 * - `message`: a function which accepts the arguments (`id`, `language`,
 * `data`). It has properties keyed by two-letter language codes, which by
 * default includes only `en`.
 * - `Promise`: by default, the native Promise implementation is used. If an
 * alternative is desired, simply assign this property with the new Promise
 * class. This will affect all instances of Fortune.
 *
 * Note: in the browser version, `serializers` and `net` are omitted.
 */
function Fortune (options) {
  if (!(this instanceof Fortune)) return new Fortune(options)
  this.constructor(options)
}


// Inherit from EventEmitter class.
Fortune.prototype = assign(Object.create(EventEmitter.prototype))


/**
 * Create a new instance. The options object may be as follows:
 *
 * ```js
 * {
 *   // Adapter configuration. Default: `memoryAdapter`
 *   adapter: {
 *     // Must be a class that extends `Fortune.Adapter`, or a function
 *     // that accepts the Adapter class and returns a subclass. Required.
 *     type: Adapter => { ... },
 *
 *     // An options object that is specific to the adapter. Optional.
 *     options: { ... }
 *   },
 *
 *   // Serializers ordered by priority. Default: ad hoc JSON-over-HTTP.
 *   serializers: [{
 *     // Must be a class that extends `Fortune.Serializer`, or a function
 *     // that accepts the Serializer class and returns a subclass. Required.
 *     type: Serializer => { ... },
 *
 *     // An options object that is specific to the serializer. Optional.
 *     options: { ... }
 *   }],
 *
 *   // Whether or not to enforce referential integrity. Default: `true` for
 *   // server, `false` for browser.
 *   enforceLinks: true
 * }
 * ```
 *
 * @param {Object} [options]
 * @return {Fortune}
 */
Fortune.prototype.constructor = function (options) {
  var self = this
  var recordTypes = {}
  var transforms = {}
  var flows = {}
  var keys = Object.keys(methods)
  var adapter, serializer
  var i, j, k, l

  if (options === void 0) options = {}
  if (!('adapter' in options)) options.adapter = { type: memoryAdapter }
  if (!('enforceLinks' in options)) options.enforceLinks = true

  // Bind middleware methods to instance.
  for (i = keys.length; i--;) {
    j = keys[i]
    k = [ middlewares[j], middlewares.include, middlewares.end ]

    for (l = k.length; l--;)
      k[l] = bindMiddleware(self, k[l])

    flows[methods[j]] = k
  }

  /*!
   * Adapter singleton that is coupled to the Fortune instance.
   *
   * @type {Adapter}
   */
  adapter = new AdapterSingleton({
    adapter: options.adapter,
    recordTypes: recordTypes,
    transforms: transforms
  })

  /*!
   * Serializer singleton that is coupled to the Fortune instance.
   *
   * @type {Serializer}
   */
  serializer = new SerializerSingleton({
    serializers: options.serializers,
    adapter: adapter,
    recordTypes: recordTypes,
    transforms: transforms
  })

  Object.defineProperties(self, {

    // 0 = not started, 1 = started, 2 = done.
    connectionStatus: { value: 0, writable: true },

    // Used for method chaining.
    currentType: { value: null, writable: true },

    // Configuration settings.
    options: { value: options },
    transforms: { value: transforms },
    recordTypes: { value: recordTypes },

    // Singleton instances.
    adapter: { value: adapter },
    serializer: { value: serializer },

    // Dispatch.
    flows: { value: flows }
  })
}


/**
 * This method should be called when all setup is done. After this method
 * succeeds, record types can not be defined. The resolved value
 * is the instance of Fortune.
 *
 * @return {Promise}
 */
Fortune.prototype.connect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus === 1)
    throw new Error('Connection is in progress.')

  else if (self.connectionStatus === 2)
    throw new Error('Connection is already done.')

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    ensureTypes(self.recordTypes)

    self.adapter.connect().then(function () {
      self.connectionStatus = 2
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 0
      return reject(error)
    })
  })
}


/**
 * Close adapter connection, and reset state. The resolved value is the
 * instance of Fortune.
 *
 * @return {Promise}
 */
Fortune.prototype.disconnect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus !== 2)
    throw new Error('Instance has not been connected.')

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    return self.adapter.disconnect().then(function () {
      self.connectionStatus = 0
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 2
      return reject(error)
    })
  })
}


/**
 * Define a record type given a name and a set of field definitions. The
 * `fields` object only serves to enforce data types, and may be extended by
 * the specific `Adapter` to express more, such as validations, uniqueness,
 * indexing, etc. Here are some example field definitions:
 *
 * ```js
 * {
 *   // A singular value.
 *   name: { type: String },
 *
 *   // An array containing values of a single type.
 *   luckyNumbers: { type: Number, isArray: true },
 *
 *   // Creates a to-many link to `animal` record type. If the field `owner`
 *   // on the `animal` record type is not an array, this is a many-to-one
 *   // relationship, otherwise it is many-to-many.
 *   pets: { link: 'animal', isArray: true, inverse: 'owner' },
 *
 *   // The `min` and `max` keys are open to interpretation by the specific
 *   // adapter or serializer, which may introspect the field definition.
 *   thing: { type: Number, min: 0, max: 100 },
 *
 *   // Nested field definitions are invalid. Use `Object` type instead.
 *   nested: { thing: { ... } } // Will throw an error.
 * }
 * ```
 *
 * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
 * `Object`, and `Buffer`. Note that the `Object` type should be a JSON
 * serializable object that may be persisted. The only other allowed type is
 * a `Function`, which may be used to define custom types.
 *
 * A type function should accept one argument, the value, and return a boolean
 * based on whether the value is valid for the type or not. It may optionally
 * have properties `sort` and `equal`, which should be valued as functions.
 *
 * - `compare`: same signature as comparing with `Array.prototype.sort`.
 * - `equal`: return a boolean value if the two arguments are equal.
 *
 * These optional functions are used for the memory adapter and web browser
 * adapters, but may not be run by other adapters.
 *
 * @param {String} name - Name of the record type.
 * @param {Object} fields - A hash of field definition objects.
 * @return {Fortune}
 */
Fortune.prototype.defineType = function (name, fields) {
  var recordTypes = this.recordTypes

  if (this.connectionStatus !== 0)
    throw new Error('Cannot define new record types after connection.')

  if (typeof name !== 'string')
    throw new TypeError('Name must be a string.')

  if (!name.length)
    throw new Error('Name must be non-trivial.')

  if (name in plainObject)
    throw new Error('The name "' + name +
      '" must not be in Object.prototype.')

  if (name in recordTypes)
    throw new Error('The record type "' + name + '" was already defined.')

  if (typeof fields !== 'object')
    throw new TypeError('Fields for "' + name + '" must be an object.')

  recordTypes[name] = validate(fields)

  // Memoize the current name, for chaining methods.
  this.currentType = name

  return this
}


/**
 * This is the primary method for initiating a request. The options object
 * must be formatted as follows:
 *
 * ```js
 * {
 *   // The method is a either a function or a constant, which is keyed under
 *   // `Fortune.methods` and may be one of `find`, `create`, `update`,  or
 *   // `delete`. To implement a custom method, pass a function that accepts
 *   // one argument, the context. It may return the context synchronously or
 *   // as a Promise. Default: `methods.find`.
 *   method: methods.find,
 *
 *   type: undefined, // Name of a type. Optional.
 *   ids: undefined, // An array of IDs. Optional.
 *
 *   // A 2-dimensional array specifying links to include. The first
 *   // dimension is a list, the second dimension is depth. For example:
 *   // [['comments'], ['comments', 'author']]
 *   include: [],
 *
 *   // Exactly the same as the adapter's `find` method options. The options
 *   // apply only to the primary type on `find` requests.
 *   options: { ... },
 *
 *   // Same as `options`, but is an object keyed by type. This is only
 *   // used in conjunction with the `include` option.
 *   includeOptions: { [type]: { ... } },
 *
 *   // The ID of the serializer to use for the input (request). Optional.
 *   serializerInput: undefined,
 *
 *   // The ID of the serializer to use for the output (response). Optional.
 *   serializerOutput: undefined,
 *
 *   meta: { ... }, // Meta-info of the request.
 *   payload: undefined // Payload of the request.
 * }
 * ```
 *
 * The response object looks much simpler:
 *
 * ```js
 * {
 *   meta: { ... }, // Meta-info of the response.
 *   payload: undefined // Payload of the response.
 * }
 * ```
 *
 * The resolved response object should always be typed.
 *
 * @param {Object} options
 * @param {...*} [args] - At most two additional arguments.
 * @return {Promise}
 */
Fortune.prototype.request = function (options, a, b) {
  if (this.connectionStatus !== 2)
    throw new Error('Instance must be connected before making a request.')

  return dispatch(this, options, a, b)
}


/**
 * Define a transformation per record type.
 *
 * A transform function takes at least two arguments, the internal `context`
 * object and a single `record`. A special case is the `update` argument for
 * the `update` method.
 *
 * There are two kinds of transforms, before a record is written to transform
 * input, and after it is read to transform output, both are optional. If an
 * error occurs within an transform function, it will be forwarded to the
 * response. Use typed errors to provide the appropriate feedback. It is
 * varant to note that `output` transforms are run every time a record is
 * shown in a response, so it should be idempotent.
 *
 * For a create request, the input transform must return the second argument
 * `record` either synchronously, or asynchronously as a Promise. The return
 * value of a delete request is inconsequential, but it may return a value or
 * a Promise. There is a special case of the `update` method accepting a
 * `update` object as a third parameter, which must be returned synchronously
 * or as a Promise.
 *
 * An example transform to apply a timestamp on a record before creation,
 * and displaying the timestamp in the server's locale:
 *
 * ```js
 * const { methods: {
 *   create: createMethod, update: updateMethod
 * } } = fortune
 *
 * store.transform((context, record, update) => {
 *   const { request: { method } } = context
 *
 *   if (method === createMethod) {
 *     record.timestamp = new Date()
 *     return record
 *   }
 *
 *   if (method === updateMethod) return update
 *
 *   // If we get here, return value of the delete method doesn't matter.
 *   return null
 * }, (context, record) => {
 *   record.timestamp = record.timestamp.toLocaleString()
 *   return record
 * })
 * ```
 *
 * Requests to update a record will **NOT** have the updates already applied to
 * the record.
 *
 * Another feature of the input transform is that it will have access to a
 * temporary field `context.transaction`. This is useful for ensuring that bulk
 * write operations are all or nothing. Each request is treated as a single
 * transaction.
 *
 * @param {String} [type]
 * @param {Function} [input]
 * @param {Function} [output]
 * @return {Fortune}
 */
Fortune.prototype.transform = function (type, input, output) {
  var recordTypes = this.recordTypes
  var transforms = this.transforms

  if (arguments.length < 3) {
    input = arguments[0]
    output = arguments[1]
    type = this.currentType
  }

  if (typeof input !== 'function' && typeof output !== 'function')
    throw new TypeError('A function must be passed to transform.')

  if (!(type in recordTypes))
    throw new Error('Attempted to define transform on "' + type + '" ' +
      'type which does not exist.')

  if (!(type in transforms))
    transforms[type] = {}

  if (typeof input === 'function')
    transforms[type].input = input

  if (typeof output === 'function')
    transforms[type].output = output

  return this
}


/**
 * Convenience method to define only the `input` argument of a transform.
 *
 * @param {String} [type]
 * @param {Function} fn
 * @return {Fortune}
 */
Fortune.prototype.transformInput = function (type, fn) {
  if (arguments.length < 2) {
    fn = type
    type = this.currentType
  }

  return this.transform(type, fn, null)
}


/**
 * Convenience method to define only the `output` argument of a transform.
 *
 * @param {String} [type]
 * @param {Function} fn
 * @return {Fortune}
 */
Fortune.prototype.transformOutput = function (type, fn) {
  if (arguments.length < 2) {
    fn = type
    type = this.currentType
  }

  return this.transform(type, null, fn)
}


/**
 * This is a static method on the Fortune class that is an alias for
 * `new Fortune(options)`. This method will be deprecated in future versions.
 *
 * @param {Object} [options]
 * @return {Fortune}
 */
Fortune.create = function () {
  // This method exists for documentation purposes.
}

delete Fortune.create


// Assign useful static properties to the default export.
defineEnumerable(Fortune, {
  Adapter: Adapter,
  Serializer: Serializer,
  errors: errors,
  methods: methods,
  message: message,
  change: change
})


// Internal helper function.
function bindMiddleware (scope, method) {
  return function (x) {
    return method.call(scope, x)
  }
}


module.exports = Fortune
