'use strict'

var EventLite = require('event-lite')

// Local modules.
var memoryAdapter = require('./adapter/adapters/memory')
var AdapterSingleton = require('./adapter/singleton')
var assign = require('./common/assign')
var validate = require('./record_type/validate')
var ensureTypes = require('./record_type/ensure_types')
var dispatch = require('./dispatch')
var promise = require('./common/promise')
var middlewares = dispatch.middlewares

// Static re-exports.
var Adapter = require('./adapter')
var errors = require('./common/errors')
var methods = require('./common/methods')
var events = require('./common/events')
var message = require('./common/message')


/**
 * This is the default export of the `fortune` package. It implements a
 * subset of `EventEmitter`, and it has a few static properties attached to it
 * that may be useful to access:
 *
 * - `Adapter`: abstract base class for the Adapter.
 * - `adapters`: included adapters, defaults to memory adapter. Note that the
 * browser build also includes `indexedDB` and `webStorage` adapters.
 * - `net`: network protocol helpers, varies based on client or server build.
 * - `errors`: custom typed errors, useful for throwing errors in I/O hook
 * functions.
 * - `methods`: a hash that maps to string constants. Available are: `find`,
 * `create`, `update`, and `delete`.
 * - `events`: names for events on the Fortune instance.
 * - `message`: a function which accepts the arguments (`id`, `language`,
 * `data`). It has properties keyed by two-letter language codes, which by
 * default includes only `en`.
 * - `Promise`: by default, the native Promise implementation is used in the
 * browser, or [Bluebird](https://github.com/petkaantonov/bluebird/) in
 * Node.js. If an alternative is desired, simply assign this property with the
 * new Promise class. This will affect all instances of Fortune.
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
 *   recordType: {
 *     // A singular value.
 *     name: { type: String },
 *
 *     // An array containing values of a single type.
 *     luckyNumbers: { type: Number, isArray: true },
 *
 *     // Creates a to-many link to `animal` record type. If the field `owner`
 *     // on the `animal` record type is not an array, this is a many-to-one
 *     // relationship, otherwise it is many-to-many.
 *     pets: { link: 'animal', isArray: true, inverse: 'owner' },
 *
 *     // The `min` and `max` keys are open to interpretation by the specific
 *     // adapter, which may introspect the field definition.
 *     thing: { type: Number, min: 0, max: 100 },
 *
 *     // Nested field definitions are invalid. Use `Object` type instead.
 *     nested: { thing: { ... } } // Will throw an error.
 *   }
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
 * - `adapter`: configuration array for the adapter. The default type is the
 *   memory adapter. If the value is not an array, its settings will be
 *   considered omitted.
 *
 *   ```js
 *   {
 *     adapter: [
 *       // Must be a class that extends `Fortune.Adapter`, or a function
 *       // that accepts the Adapter class and returns a subclass. Required.
 *       Adapter => { ... },
 *
 *       // An options object that is specific to the adapter. Optional.
 *       { ... }
 *     ]
 *   }
 *   ```
 *
 * - `hooks`: keyed by type name, valued by an array containing an `input`
 *   and/or `output` function at indices `0` and `1` respectively.
 *
 *   A hook function takes at least two arguments, the internal `context`
 *   object and a single `record`. A special case is the `update` argument for
 *   the `update` method.
 *
 *   There are only two kinds of hooks, before a record is written (input),
 *   and after a record is read (output), both are optional. If an error occurs
 *   within a hook function, it will be forwarded to the response. Use typed
 *   errors to provide the appropriate feedback.
 *
 *   For a create request, the input hook may return the second argument
 *   `record` either synchronously, or asynchronously as a Promise. The return
 *   value of a delete request is inconsequential, but it may return a value or
 *   a Promise. The `update` method accepts a `update` object as a third
 *   parameter, which may be returned synchronously or as a Promise.
 *
 *   An example hook to apply a timestamp on a record before creation, and
 *   displaying the timestamp in the server's locale:
 *
 *   ```js
 *   {
 *     recordType: [
 *       (context, record, update) => {
 *         switch (context.request.method) {
 *           case 'create':
 *             record.timestamp = new Date()
 *             return record
 *           case 'update': return update
 *           case 'delete': return null
 *         }
 *       },
 *       (context, record) => {
 *         record.timestamp = record.timestamp.toLocaleString()
 *         return record
 *       }
 *     ]
 *   }
 *   ```
 *
 *   Requests to update a record will **NOT** have the updates already applied
 *   to the record.
 *
 *   Another feature of the input hook is that it will have access to a
 *   temporary field `context.transaction`. This is useful for ensuring that
 *   bulk write operations are all or nothing. Each request is treated as a
 *   single transaction.
 *
 * - `documentation`: an object mapping names to descriptions. Note that there
 *   is only one namepspace, so field names can only have one description.
 *   This is optional, but useful for the HTML serializer, which also emits
 *   this information as micro-data.
 *
 *   ```js
 *   {
 *     documentation: {
 *       recordType: 'Description of a type.',
 *       fieldName: 'Description of a field.',
 *       anotherFieldName: {
 *         en: 'Two letter language code indicates localized description.'
 *       }
 *     }
 *   }
 *   ```
 *
 * - `settings`: internal settings to configure.
 *
 *   ```js
 *   {
 *     settings: {
 *       // Whether or not to enforce referential integrity. Default: `true`
 *       // for server, `false` for browser.
 *       enforceLinks: true,
 *
 *       // Name of the application used for display purposes.
 *       name: 'My Awesome Application',
 *
 *       // Description of the application used for display purposes.
 *       description: 'media type "application/vnd.micro+json"'
 *     }
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
  var adapter, method, stack, flows, type, hooks, i, j

  if (typeof recordTypes !== 'object')
    throw new TypeError('First argument must be an object.')

  if (!Object.keys(recordTypes).length)
    throw new Error('At least one type must be specified.')

  // DEPRECATION: "transforms" has been deprecated in favor of "hooks".
  if ('transforms' in options) options.hooks = options.transforms

  if (!('adapter' in options)) options.adapter = [ memoryAdapter ]
  if (!('settings' in options)) options.settings = {}
  if (!('hooks' in options)) options.hooks = {}
  if (!('enforceLinks' in options.settings))
    options.settings.enforceLinks = true

  // Bind middleware methods to instance.
  flows = {}
  for (method in methods) {
    stack = [ middlewares[method], middlewares.include, middlewares.end ]

    for (i = 0, j = stack.length; i < j; i++)
      stack[i] = bindMiddleware(self, stack[i])

    flows[methods[method]] = stack
  }

  hooks = options.hooks

  // Validate hooks.
  for (type in hooks) {
    if (!(type in recordTypes)) throw new Error(
      'Attempted to define hook on "' + type + '" type ' +
      'which does not exist.')
    if (!Array.isArray(hooks[type]))
      throw new TypeError('Hook value for "' + type + '" type ' +
        'must be an array.')
  }

  // Validate record types.
  for (type in recordTypes) {
    validate(recordTypes[type])
    if (!(type in hooks)) hooks[type] = []
  }

  /*!
   * Adapter singleton that is coupled to the Fortune instance.
   *
   * @type {Adapter}
   */
  adapter = new AdapterSingleton({
    adapter: options.adapter,
    recordTypes: recordTypes,
    hooks: hooks
  })

  // Internal properties.
  Object.defineProperties(self, {
    // 0 = not started, 1 = started, 2 = done.
    connectionStatus: { value: 0, writable: true },

    // Configuration settings.
    options: { value: options },
    hooks: { value: hooks },
    recordTypes: { value: recordTypes, enumerable: true },

    // Singleton instances.
    adapter: { value: adapter, enumerable: true, configurable: true },

    // Dispatch.
    flows: { value: flows }
  })
}


/**
 * This is the primary method for initiating a request. The options object
 * may contain the following keys:
 *
 * - `method`: The method is a either a function or a constant, which is keyed
 *   under `Fortune.methods` and may be one of `find`, `create`, `update`,  or
 *   `delete`. Default: `find`.
 *
 * - `type`: Name of a type. **Required**.
 *
 * - `ids`: An array of IDs. Used for `find` and `delete` methods only. This is
 *   optional for the `find` method.
 *
 * - `include`: A 2-dimensional array specifying links to include. The first
 *   dimension is a list, the second dimension is depth. For example:
 *   `[['comments'], ['comments', 'author', { ... }]]`. The last item within
 *   the list may be an `options` object, useful for specifying how the
 *   included records should appear. Optional.
 *
 * - `options`: Exactly the same as the [`find` method](#adapter-find)
 *   options in the adapter. These options do not apply on methods other than
 *   `find`, and do not affect the records returned from `include`. Optional.
 *
 * - `meta`: Meta-information object of the request. Optional.
 *
 * - `payload`: Payload of the request. **Required** for `create` and `update`
 *   methods only, and must be an array of objects. The objects must be the
 *   records to create, or update objects as expected by the Adapter.
 *
 * The response object may contain the following keys:
 *
 * - `meta`: Meta-info of the response.
 *
 * - `payload`: An object containing the following keys:
 *   - `records`: An array of records returned.
 *   - `count`: Total number of records without options applied (only for
 *     responses to the `find` method).
 *   - `include`: An object keyed by type, valued by arrays of included
 *     records.
 *
 * The resolved response object should always be an instance of a response
 * type.
 *
 * @param {Object} options
 * @return {Promise}
 */
Fortune.prototype.request = function (options) {
  var self = this
  var Promise = promise.Promise
  var connectionStatus = self.connectionStatus

  if (connectionStatus === 0)
    return self.connect()
    .then(function () { return dispatch(self, options) })

  else if (connectionStatus === 1)
    return new Promise(function (resolve, reject) {
      // Wait for changes to connection status.
      self.once(events.failure, function () {
        reject(new Error('Connection failed.'))
      })
      self.once(events.connect, function () {
        resolve(dispatch(self, options))
      })
    })

  return dispatch(self, options)
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
      self.emit(events.connect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 0
      self.emit(events.failure)
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
      self.emit(events.disconnect)
      return resolve(self)
    }, function (error) {
      self.connectionStatus = 2
      self.emit(events.failure)
      return reject(error)
    })
  })
}


// Assign useful static properties to the default export.
assign(Fortune, {
  Adapter: Adapter,
  errors: errors,
  methods: methods,
  message: message,
  events: events
})


// Internal helper function.
function bindMiddleware (scope, method) {
  return function (x) {
    return method.call(scope, x)
  }
}


module.exports = Fortune
