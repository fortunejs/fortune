'use strict'

var EventLite = require('event-lite')

// Local modules.
var memoryAdapter = require('./adapter/adapters/memory')
var AdapterSingleton = require('./adapter/singleton')
var SerializerSingleton = require('./serializer/singleton')
var defineEnumerable = require('./common/define_enumerable')
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
var connect = constants.connect
var disconnect = constants.disconnect
var failure = constants.failure


/**
 * This is the default export of the `fortune` package. It implements a
 * subset of `EventEmitter`, and it has a few static properties attached to it
 * that may be useful to access:
 *
 * - `Adapter`: abstract base class for the Adapter.
 * - `adapters`: included adapters, defaults to memory adapter. Note that the
 * browser build also includes `indexedDB` and `webStorage` adapters.
 * - `Serializer`: abstract base class for the Serializer.
 * - `serializers`: included serializers. Server-side only.
 * - `net`: network protocol helpers.
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
 */
function Fortune (options) {
  this.constructor(options)
}


// Inherit from EventLite class.
Fortune.prototype = Object.create(EventLite.prototype)


/**
 * Create a new instance, the only required input is record type definitions.
 * The first argument must be an object keyed by name, valued by definition
 * objects. Here are some example field definitions:
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
 * A type function should accept one argument, the value, and return a
 * boolean based on whether the value is valid for the type or not. It may
 * optionally have properties `sort` and `equal`, which should be valued as
 * functions.
 *
 * - `compare`: same signature as comparing with `Array.prototype.sort`.
 * - `equal`: return a boolean value if the two arguments are equal.
 *
 * These optional functions are used for the memory adapter and web browser
 * adapters, but may not be run by other adapters.
 *
 * The options object may contain the following keys:
 *
 * - `adapter`: configuration object for the adapter. The default type is the
 *   memory adapter.
 *
 *   ```js
 *   {
 *     // Must be a class that extends `Fortune.Adapter`, or a function
 *     // that accepts the Adapter class and returns a subclass. Required.
 *     type: Adapter => { ... },
 *
 *     // An options object that is specific to the adapter. Optional.
 *     options: { ... }
 *   }
 *   ```
 *
 * - `serializers`: an array of serializers ordered by priority. If none is
 *   specified, at least the default serializer will be used. On the server,
 *   this includes an ad hoc JSON over HTTP serializer by default.
 *
 *   ```js
 *   [{
 *     // Must be a class that extends `Fortune.Serializer`, or a function
 *     // that accepts the Serializer class and returns a subclass. Required.
 *     type: Serializer => { ... },
 *
 *     // An options object that is specific to the serializer. Optional.
 *     options: { ... }
 *   }]
 *   ```
 *
 * - `transforms`: keyed by type name, valued by an object containing at least
 *   an `input` or `output` key, valued as a function.
 *
 *   A transform function takes at least two arguments, the internal `context`
 *   object and a single `record`. A special case is the `update` argument for
 *   the `update` method.
 *
 *   There are two kinds of transforms, before a record is written to transform
 *   input, and after it is read to transform output, both are optional. If an
 *   error occurs within an transform function, it will be forwarded to the
 *   response. Use typed errors to provide the appropriate feedback. It is
 *   varant to note that `output` transforms are run every time a record is
 *   shown in a response, so it should be idempotent.
 *
 *   For a create request, the input transform must return the second argument
 *   `record` either synchronously, or asynchronously as a Promise. The return
 *   value of a delete request is inconsequential, but it may return a value or
 *   a Promise. There is a special case of the `update` method accepting a
 *   `update` object as a third parameter, which must be returned synchronously
 *   or as a Promise.
 *
 *   An example transform to apply a timestamp on a record before creation,
 *   and displaying the timestamp in the server's locale:
 *
 *   ```js
 *   {
 *     input (context, record, update) {
 *       const method = context.request.method
 *
 *       if (method === 'create') {
 *         record.timestamp = new Date()
 *         return record
 *       }
 *
 *       if (update) return update
 *
 *       // If we get here, return value of the delete method doesn't matter.
 *       return null
 *     },
 *     output (context, record) {
 *       record.timestamp = record.timestamp.toLocaleString()
 *       return record
 *     }
 *   }
 *   ```
 *
 *   Requests to update a record will **NOT** have the updates already applied
 *   to the record.
 *
 *   Another feature of the input transform is that it will have access to a
 *   temporary field `context.transaction`. This is useful for ensuring that
 *   bulk write operations are all or nothing. Each request is treated as a
 *   single transaction.
 *
 * - `settings`: internal settings to configure.
 *
 *   ```js
 *   {
 *     // Whether or not to enforce referential integrity. Default: `true` for
 *     // server, `false` for browser.
 *     enforceLinks: true
 *   }
 *   ```
 *
 * The return value of the constructor is the instance itself.
 *
 * @param {Object} recordTypes
 * @param {Object} [options]
 * @return {Fortune}
 */
Fortune.prototype.constructor = function (recordTypes, options) {
  var self = this
  var i, adapter, serializer, method, stack, flows, type, transforms

  if (typeof recordTypes !== 'object')
    throw new TypeError('First argument must be an object.')

  if (!Object.keys(recordTypes).length)
    throw new Error('At least one type must be specified.')

  if (!('adapter' in options)) options.adapter = { type: memoryAdapter }
  if (!('settings' in options)) options.settings = {}
  if (!('transforms' in options)) options.transforms = {}
  if (!('enforceLinks' in options.settings))
    options.settings.enforceLinks = true

  // Bind middleware methods to instance.
  flows = {}
  for (method in methods) {
    stack = [ middlewares[method], middlewares.include, middlewares.end ]

    for (i = stack.length; i--;)
      stack[i] = bindMiddleware(self, stack[i])

    flows[methods[method]] = stack
  }

  transforms = options.transforms

  // Validate transforms.
  for (type in transforms) {
    if (!(type in recordTypes)) throw new Error(
      'Attempted to define transform on "' + type + '" type ' +
      'which does not exist.')
    if (typeof transforms[type] !== 'object')
      throw new TypeError('Transform value for " + type + " type ' +
        'must be an object.')
    if (!('input' in transforms[type]) && !('output' in transforms[type]))
      throw new Error('At least an "input" or "output" function ' +
        'must be defined.')
  }

  // Validate record types.
  for (type in recordTypes) {
    validate(recordTypes[type])
    if (!(type in transforms)) transforms[type] = {}
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
 * This method does not need to be called manually, it is automatically called
 * upon the first request if it is not connected already. However, it may be
 * useful if manually reconnect is needed. The resolved value is the instance
 * itself.
 *
 * @return {Promise}
 */
Fortune.prototype.connect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus === 1)
    return Promise.reject(new Error('Connection is in progress.'))

  else if (self.connectionStatus === 2)
    return Promise.reject(new Error('Connection is already done.'))

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    ensureTypes(self.recordTypes)

    self.adapter.connect().then(function () {
      self.connectionStatus = 2
      self.emit(connect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 0
      self.emit(failure)
      return reject(error)
    })
  })
}


/**
 * Close adapter connection, and reset connection state. The resolved value is
 * the instance itself.
 *
 * @return {Promise}
 */
Fortune.prototype.disconnect = function () {
  var self = this
  var Promise = promise.Promise

  if (self.connectionStatus !== 2)
    return Promise.reject(new Error('Instance has not been connected.'))

  self.connectionStatus = 1

  return new Promise(function (resolve, reject) {
    return self.adapter.disconnect().then(function () {
      self.connectionStatus = 0
      self.emit(disconnect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 2
      self.emit(failure)
      return reject(error)
    })
  })
}


/**
 * This is the primary method for initiating a request. The options object
 * may contain the following keys:
 *
 * - `method`: The method is a either a function or a constant, which is keyed
 *   under `Fortune.methods` and may be one of `find`, `create`, `update`,  or
 *   `delete`. To implement a custom method, pass a function that accepts
 *   one argument, the context. It may return the context synchronously or
 *   as a Promise. Default: `find`.
 *
 * - `type`: Name of a type. Optional for `find` method only.
 *
 * - `ids`: An array of IDs. Optional.
 *
 * - `include`: A 2-dimensional array specifying links to include. The first
 *   dimension is a list, the second dimension is depth. For example:
 *   `[['comments'], ['comments', 'author']]`. Optional.
 *
 * - `options`: Exactly the same as the adapter's `find` method options. The
 *   options apply only to the primary type on `find` requests. Optional.
 *
 * - `includeOptions`: Same as `options`, but is an object keyed by type. This
 *   is only used in conjunction with the `include` option. For example:
 *   `{ [type]: { ... } }`. Optional.
 *
 * - `serializerInput`: The ID of the serializer to use for parsing the payload
 *   of the request. Optional.
 *
 * - `serializerOutput`: The ID of the serializer to use for the output of the
 *   response, including `processRequest` and `processResponse`. Optional.
 *
 * - `meta`: Meta-information object of the request. Optional.
 *
 * - `payload`: Payload of the request. Optional.
 *
 * The response object contains the following keys:
 *
 * - `meta`: Meta-info of the response.
 * - `payload`: Payload of the response.
 *
 * The resolved response object should always be an instance of a response
 * type.
 *
 * @param {Object} options
 * @param {...*} [args] - At most two additional arguments.
 * @return {Promise}
 */
Fortune.prototype.request = function (options, a, b) {
  var self = this
  var Promise = self.Promise
  var connectionStatus = self.connectionStatus

  if (connectionStatus === 0)
    return self.connect()
    .then(function () { return dispatch(self, options, a, b) })

  else if (connectionStatus === 1)
    return new Promise(function (resolve, reject) {
      // Wait for changes to connection status.
      self.once(failure, function () {
        reject(new Error('Connection failed.'))
      })
      self.once(connect, function () {
        resolve(dispatch(self, options, a, b))
      })
    })

  return dispatch(self, options, a, b)
}


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
