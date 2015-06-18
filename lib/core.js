// Local modules.
import AdapterSingleton from './adapter/singleton'
import SerializerSingleton from './serializer/singleton'
import Dispatcher, { dispatch } from './dispatcher'
import defineArguments from './common/define_arguments'
import validate from './record_type/validate'
import ensureTypes from './record_type/ensure_types'

// Static exports.
import * as errors from './common/errors'


/**
 * This is the default export of the `fortune` package. Each instance of
 * Fortune keeps track of three singletons: the adapter, serializer, and
 * dispatcher, which are accessible at `this.adapter`, `this.serializer`,
 * and `this.dispatcher` respectively. The Fortune class has a few static
 * properties attached to it that may be useful to access:
 *
 * - `adapters`: included adapters, currently only NeDB.
 * - `serializers`: included serializers, currently Micro API and JSON API.
 * - `net`: network protocol helpers, currently only HTTP.
 * - `errors`: custom typed errors, useful for throwing errors in transform
 * functions.
 *
 * Note: in the `fortune/core` build, only `errors` is included as a static
 * property.
 */
export default class Fortune {

  /**
   * Create a new instance. The options object may be as follows:
   *
   * ```js
   * {
   *   // Adapter configuration. Default: NeDB
   *   adapter: {
   *     // Must be a class that extends `Fortune.Adapter`, or a function
   *     // that accepts the Adapter class and returns a subclass. Required.
   *     type: Adapter => { ... },
   *
   *     // An options object that is specific to the adapter. Optional.
   *     options: { ... }
   *   },
   *
   *   // Serializers ordered by priority. Default: Micro API, JSON API
   *   serializers: [{
   *     // Must be a class that extends `Fortune.Serializer`, or a function
   *     // that accepts the Serializer class and returns a subclass. Required.
   *     type: Serializer => { ... },
   *
   *     // An options object that is specific to the serializer. Optional.
   *     options: { ... }
   *   }]
   * }
   * ```
   *
   * @param {Object} [options]
   * @return {Fortune}
   */
  constructor (options = {}) {
    if (!('adapter' in options))
      throw new Error(`An adapter is required.`)

    const [ recordTypes, transforms ] = [ {}, {} ]

    // The singletons are responsible for extracting options and doing
    // dependency injection.

    const adapter = new AdapterSingleton({
      adapter: options.adapter,
      recordTypes
    })

    const serializer = new SerializerSingleton({
      serializers: options.serializers,
      adapter, recordTypes
    })

    const dispatcher = new Dispatcher({
      adapter, serializer, recordTypes, transforms
    })

    Object.defineProperties(this, {

      // 0 = not started, 1 = started, 2 = done.
      connectionStatus: { value: 0, writable: true },

      // Used for method chaining.
      currentType: { value: undefined, writable: true },

      // Configuration settings.
      options: { value: options },
      transforms: { value: transforms },
      recordTypes: { value: recordTypes },

      // Singleton instances.
      adapter: { value: adapter, enumerable: true },
      serializer: { value: serializer, enumerable: true },
      dispatcher: { value: dispatcher, enumerable: true }

    })
  }


  /**
   * This method should be called when all setup is done. After this method
   * succeeds, record types can not be defined. The resolved value
   * is the instance of Fortune.
   *
   * @return {Promise}
   */
  start () {
    if (this.connectionStatus === 1)
      throw new Error(`Connection is in progress.`)

    else if (this.connectionStatus === 2)
      throw new Error(`Connection is already done.`)

    this.connectionStatus = 1

    return new Promise((resolve, reject) => {
      ensureTypes(this.recordTypes)

      this.adapter.connect().then(() => {
        this.connectionStatus = 2
        return resolve(this)
      }, error => {
        this.connectionStatus = 0
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
  stop () {
    if (this.connectionStatus !== 2)
      throw new Error(`Instance has not been started.`)

    this.connectionStatus = 1

    return new Promise((resolve, reject) =>
      this.adapter.disconnect().then(() => {
        this.connectionStatus = 0
        return resolve(this)
      }, error => {
        this.connectionStatus = 2
        return reject(error)
      }))
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
   *   lucky_numbers: { type: Number, isArray: true },
   *
   *   // Creates a to-many link to `animal` record type. If the field `owner`
   *   // on the `animal` record type is not an array, this is a many-to-one
   *   // relationship, otherwise it is many-to-many.
   *   pets: { link: 'animal', isArray: true, inverse: 'owner' },
   *
   *   // The `min` and `max` keys are open to interpretation by the specific
   *   // adapter, which may introspect the field definition.
   *   thing: { type: Number, min: 0, max: 100 },
   *
   *   // Nested field definitions are invalid. Use `Object` type instead.
   *   nested: { thing: { ... } } // wrong
   * }
   * ```
   *
   * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
   * `Object`, and `Buffer`. Note that the `Object` type should be a JSON
   * serializable object that may be persisted. The only other allowed type is
   * a `Symbol`, which may be used to represent custom types.
   *
   * @param {String} name - Name of the record type.
   * @param {Object} fields - A hash of field definition objects.
   * @return {this}
   */
  defineType (name, fields) {
    const { recordTypes } = this

    if (this.connectionStatus !== 0)
      throw new Error(`Cannot define new record types after connection.`)

    if (typeof name !== 'string')
      throw new TypeError(`Name must be a string.`)

    if (!name.length)
      throw new Error(`Name must be non-trivial.`)

    if (name in recordTypes)
      throw new Error(`The record type "${name}" was already defined.`)

    if (typeof fields !== 'object')
      throw new TypeError(`Fields for "${name}" must be an object.`)

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
   *   // The method is a either a function or a Symbol, keyed under
   *   // `dispatcher.methods` and may be one of `find`, `create`, `update`,
   *   // or `delete`. To implement a custom method, pass a function that
   *   // accepts one argument, the context. It may return the context
   *   // synchronously or as a Promise.
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
   * @param {...*} [args]
   * @return {Promise}
   */
  dispatch () {
    if (this.connectionStatus !== 2)
      throw new Error(`Instance must be started before dispatching.`)

    return dispatch.apply(this.dispatcher, arguments)
  }


  /**
   * Define a transformation per record type.
   *
   * A transform function takes at least two arguments, the internal `context`
   * object and a single `record`.
   *
   * There are two kinds of transforms, before a record is written to transform
   * input, and after it is read to transform output, either is optional. If an
   * error occurs within an transform function, it will be forwarded to the
   * response. Use typed errors to provide the appropriate feedback. It is
   * important to note that `output` transforms are run every time a record is
   * shown in a response, so it should be idempotent.
   *
   * For a create request, the input transform must return the second argument
   * `record` either synchronously, or asynchronously as a Promise. The return
   * value of an update or delete request is inconsequential, but it may return
   * a value or a Promise.
   *
   * An example transform to apply a timestamp on a record before creation,
   * and displaying the timestamp in the server's locale:
   *
   * ```js
   * app.transform((context, record) => {
   *   record.timestamp = new Date()
   *   return record
   * }, (context, record) => {
   *   record.timestamp = record.timestamp.toLocaleString()
   *   return record
   * })
   * ```
   *
   * Requests to update a record will have the updates already applied to the
   * record.
   *
   * @param {String} [type]
   * @param {Function} [input]
   * @param {Function} [output]
   * @return {this}
   */
  transform (type, input, output) {
    const { recordTypes, transforms } = this

    if (arguments.length < 3) {
      input = arguments[0]
      output = arguments[1]
      type = this.currentType
    }

    if (![ input, output ].some(fn => typeof fn === 'function'))
      throw new TypeError(`A function must be passed to transform.`)

    if (!(type in recordTypes))
      throw new Error(`Attempted to define transform on "${type}" ` +
        `type which does not exist.`)

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
   * @return {this}
   */
  transformInput (type, fn) {
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
   * @return {this}
   */
  transformOutput (type, fn) {
    if (arguments.length < 2) {
      fn = type
      type = this.currentType
    }

    return this.transform(type, null, fn)
  }


  /**
   * This is a static method on the Fortune class that is an alternative to the
   * constructor method, for people who hate the `new` keyword with a passion.
   * This is exactly the same as invoking `new Fortune(options)`.
   *
   * @param {Object} [options]
   * @return {Fortune}
   */
  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
defineArguments(Fortune, { errors })
