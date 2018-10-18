'use strict'

var EventLite = require('event-lite')

// Local modules.
var memoryAdapter = require('./adapter/adapters/memory')
var AdapterSingleton = require('./adapter/singleton')
var validate = require('./record_type/validate')
var ensureTypes = require('./record_type/ensure_types')
var promise = require('./common/promise')
var internalRequest = require('./request')
var middlewares = internalRequest.middlewares

// Static re-exports.
var Adapter = require('./adapter')
var common = require('./common')
var assign = common.assign
var methods = common.methods
var events = common.events


/**
 * This is the default export of the `fortune` package. It implements a
 * [subset of `EventEmitter`](https://www.npmjs.com/package/event-lite), and it
 * has a few static properties attached to it that may be useful to access:
 *
 * - `Adapter`: abstract base class for the Adapter.
 * - `adapters`: included adapters, defaults to memory adapter.
 * - `errors`: custom error types, useful for throwing errors in I/O hooks.
 * - `methods`: a hash that maps to string constants. Available are: `find`,
 *   `create`, `update`, and `delete`.
 * - `events`: names for events on the Fortune instance. Available are:
 *   `change`, `sync`, `connect`, `disconnect`, `failure`.
 * - `message`: a function which accepts the arguments (`id`, `language`,
 *   `data`). It has properties keyed by two-letter language codes, which by
 *   default includes only `en`.
 * - `Promise`: assign this to set the Promise implementation that Fortune
 *   will use.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune))
    return new Fortune(recordTypes, options)

  this.constructor(recordTypes, options)
}


// Inherit from EventLite class.
Fortune.prototype = new EventLite()


/**
 * Create a new instance, the only required input is record type definitions.
 * The first argument must be an object keyed by name, valued by definition
 * objects.
 *
 * Here are some example field definitions:
 *
 * ```js
 * {
 *   // Top level keys are names of record types.
 *   person: {
 *     // Data types may be singular or plural.
 *     name: String, // Singular string value.
 *     luckyNumbers: Array(Number), // Array of numbers.
 *
 *     // Relationships may be singular or plural. They must specify which
 *     // record type it refers to, and may also specify an inverse field
 *     // which is optional but recommended.
 *     pets: [ Array('animal'), 'owner' ], // Has many.
 *     employer: [ 'organization', 'employees' ], // Belongs to.
 *     likes: Array('thing'), // Has many (no inverse).
 *     doing: 'activity', // Belongs to (no inverse).
 *
 *     // Reflexive relationships are relationships in which the record type,
 *     // the first position, is of the same type.
 *     following: [ Array('person'), 'followers' ],
 *     followers: [ Array('person'), 'following' ],
 *
 *     // Mutual relationships are relationships in which the inverse,
 *     // the second position, is defined to be the same field on the same
 *     // record type.
 *     friends: [ Array('person'), 'friends' ],
 *     spouse: [ 'person', 'spouse' ]
 *   }
 * }
 * ```
 *
 * The above shows the shorthand which will be transformed internally to a
 * more verbose data structure. The internal structure is as follows:
 *
 * ```js
 * {
 *   person: {
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
 * A custom type function should accept one argument, the value, and return a
 * boolean based on whether the value is valid for the type or not. It may
 * optionally have a method `compare`, used for sorting in the built-in
 * adapters. The `compare` method should have the same signature as the native
 * `Array.prototype.sort`.
 *
 * A custom type function must inherit one of the allowed native types. For
 * example:
 *
 * ```js
 * function Integer (x) { return (x | 0) === x }
 * Integer.prototype = new Number()
 * ```
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
 *       // Whether or not to enforce referential integrity. This may be
 *       // useful to disable on the client-side.
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
 * @param {Object} [recordTypes]
 * @param {Object} [options]
 * @return {Fortune}
 */
Fortune.prototype.constructor = function Fortune (recordTypes, options) {
  var self = this
  var plainObject = {}
  var message = common.message
  var adapter, method, stack, flows, type, hooks, i, j

  if (recordTypes === void 0) recordTypes = {}
  if (options === void 0) options = {}

  if (!('adapter' in options)) options.adapter = [ memoryAdapter(Adapter) ]
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
    if (!recordTypes.hasOwnProperty(type)) throw new Error(
      'Attempted to define hook on "' + type + '" type ' +
      'which does not exist.')
    if (!Array.isArray(hooks[type]))
      throw new TypeError('Hook value for "' + type + '" type ' +
        'must be an array.')
  }

  // Validate record types.
  for (type in recordTypes) {
    if (type in plainObject)
      throw new Error('Can not define type name "' + type +
        '" which is in Object.prototype.')

    validate(recordTypes[type])
    if (!hooks.hasOwnProperty(type)) hooks[type] = []
  }

  /*!
   * Adapter singleton that is coupled to the Fortune instance.
   *
   * @type {Adapter}
   */
  adapter = new AdapterSingleton({
    adapter: options.adapter,
    recordTypes: recordTypes,
    hooks: hooks,
    message: message
  })

  self.options = options
  self.hooks = hooks
  self.recordTypes = recordTypes
  self.adapter = adapter

  // Internal properties.
  Object.defineProperties(self, {
    // 0 = not started, 1 = started, 2 = done.
    connectionStatus: { value: 0, writable: true },

    message: { value: message },
    flows: { value: flows }
  })
}


/**
 * This is the primary method for initiating a request. The options object
 * may contain the following keys:
 *
 * - `method`: The method is a either a function or a constant, which is keyed
 *   under `Fortune.common.methods` and may be one of `find`, `create`,
 *   `update`, or `delete`. Default: `find`.
 *
 * - `type`: Name of a type. **Required**.
 *
 * - `ids`: An array of IDs. Used for `find` and `delete` methods only. This is
 *   optional for the `find` method.
 *
 * - `include`: A 3-dimensional array specifying links to include. The first
 *   dimension is a list, the second dimension is depth, and the third
 *   dimension is an optional tuple with field and query options. For example:
 *   `[['comments'], ['comments', ['author', { ... }]]]`.
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
 * - `transaction`: if an existing transaction should be re-used, this may
 *   optionally be passed in. This must be ended manually.
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
  var connectionStatus = self.connectionStatus
  var Promise = promise.Promise

  if (connectionStatus === 0)
    return self.connect()
      .then(function () { return internalRequest.call(self, options) })

  else if (connectionStatus === 1)
    return new Promise(function (resolve, reject) {
      // Wait for changes to connection status.
      self.once(events.failure, function () {
        reject(new Error('Connection failed.'))
      })
      self.once(events.connect, function () {
        resolve(internalRequest.call(self, options))
      })
    })

  return internalRequest.call(self, options)
}


/**
 * The `find` method retrieves record by type given IDs, querying options,
 * or both. This is a convenience method that wraps around the `request`
 * method, see the `request` method for documentation on its arguments.
 *
 * @param {String} type
 * @param {*|*[]} [ids]
 * @param {Object} [options]
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.find = function (type, ids, options, include, meta) {
  var obj = { method: methods.find, type: type }

  if (ids) obj.ids = Array.isArray(ids) ? ids : [ ids ]
  if (options) obj.options = options
  if (include) obj.include = include
  if (meta) obj.meta = meta

  return this.request(obj)
}


/**
 * The `create` method creates records by type given records to create. This
 * is a convenience method that wraps around the `request` method, see the
 * request `method` for documentation on its arguments.
 *
 * @param {String} type
 * @param {Object|Object[]} records
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.create = function (type, records, include, meta) {
  var options = { method: methods.create, type: type,
    payload: Array.isArray(records) ? records : [ records ] }

  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
}


/**
 * The `update` method updates records by type given update objects. See the
 * [Adapter.update](#adapter-update) method for the format of the update
 * objects. This is a convenience method that wraps around the `request`
 * method, see the `request` method for documentation on its arguments.
 *
 * @param {String} type
 * @param {Object|Object[]} updates
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.update = function (type, updates, include, meta) {
  var options = { method: methods.update, type: type,
    payload: Array.isArray(updates) ? updates : [ updates ] }

  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
}


/**
 * The `delete` method deletes records by type given IDs (optional). This is a
 * convenience method that wraps around the `request` method, see the `request`
 * method for documentation on its arguments.
 *
 * @param {String} type
 * @param {*|*[]} [ids]
 * @param {Array[]} [include]
 * @param {Object} [meta]
 * @return {Promise}
 */
Fortune.prototype.delete = function (type, ids, include, meta) {
  var options = { method: methods.delete, type: type }

  if (ids) options.ids = Array.isArray(ids) ? ids : [ ids ]
  if (include) options.include = include
  if (meta) options.meta = meta

  return this.request(options)
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
    Object.defineProperty(self, 'denormalizedFields', {
      value: ensureTypes(self.recordTypes),
      writable: true,
      configurable: true
    })

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


// Useful for dependency injection. All instances of Fortune have the same
// common internal dependencies.
Fortune.prototype.common = common


// Assign useful static properties to the default export.
assign(Fortune, {
  Adapter: Adapter,
  adapters: {
    memory: memoryAdapter(Adapter)
  },
  errors: common.errors,
  message: common.message,
  methods: methods,
  events: events
})


// Set the `Promise` property.
Object.defineProperty(Fortune, 'Promise', {
  enumerable: true,
  get: function () {
    return promise.Promise
  },
  set: function (value) {
    promise.Promise = value
  }
})


// Internal helper function.
function bindMiddleware (scope, method) {
  return function (x) {
    return method.call(scope, x)
  }
}


module.exports = Fortune
