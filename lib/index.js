// local modules
import AdapterSingleton from './adapter/singleton'
import SerializerSingleton from './serializer/singleton'
import Dispatcher from './dispatcher'
import validate from './schema/validate'
import checkSchemas from './schema/check_schemas'

// static exports
import * as adapters from './adapter/adapters'
import * as serializers from './serializer/serializers'
import * as net from './net'
import * as errors from './common/errors'


/**
 * The Fortune class has a few static properties attached to it that may be
 * useful to access:
 *
 * - `adapters`: included adapters
 * - `serializers`: included serializers
 * - `net`: network protocol helpers
 * - `errors`: custom typed errors
 */
export default class Fortune {

  /**
   * Create a new instance. The options object may be as follows:
   *
   * ```js
   * {
   *   // Storage adapter configuration.
   *   // Default: NeDB
   *   adapter: {
   *     // Must be a class that extends `Fortune.Adapter`, or a function
   *     // that accepts one argument, the Adapter class, and returns a
   *     // subclass. Required.
   *     type: function (Adapter) { ... },
   *
   *     // An options object that is specific to the adapter.
   *     // Default: undefined
   *     options: {}
   *   },
   *
   *   // An array of objects ordered by priority.
   *   // Default: JSON API, Micro API
   *   serializers: [{
   *     // Must be a class that extends `Fortune.Serializer`, or a function
   *     // that accepts one argument, the Serializer class, and returns a
   *     // subclass. Required.
   *     type: function (Serializer) { ... },
   *
   *     // An options object that is specific to the serializer.
   *     // Default: undefined
   *     options: { ... }
   *   }]
   * }
   * ```
   *
   * @param {Object} [options]
   */
  constructor (options = {}) {
    if (!(options instanceof Object))
      throw new TypeError(`Argument "options" must be an object.`)

    Object.defineProperties(this, {
      // 0 = not started, 1 = started, 2 = done.
      initializationStatus: { writable: true, value: 0 },
      currentModel: { writable: true, value: undefined },
      options: { value: options },
      transforms: { value: {} },
      schemas: { value: {} }
    })
  }


  /**
   * This method must be called when all setup is done. after this method
   * succeeds, models can not be defined. The resolved value
   * is the instance of Fortune.
   *
   * @return {Promise}
   */
  initialize () {
    if (this.initializationStatus === 1)
      throw new Error(`Initialization is in progress.`)

    else if (this.initializationStatus === 2)
      throw new Error(`Initialization is already done.`)

    return new Promise((resolve, reject) => {
      checkSchemas(this.schemas)
      setDefaults.call(this)

      this.initializationStatus = 1

      // The singletons are responsible for extracting options and
      // dependencies, and doing dependency injection.
      this.adapter = new AdapterSingleton(this)
      this.serializer = new SerializerSingleton(this)
      this.dispatcher = new Dispatcher(this)

      this.adapter.initialize().then(() => {
        this.initializationStatus = 2
        return resolve(this)
      }, (error) => {
        this.initializationStatus = 0
        return reject(error)
      })
    })
  }


  /**
   * Define a model given a name and a schema definition.
   * The `schema` object only serves to enforce data types, and does do not
   * do anything more, such as validation. Here are some example fields
   * of the `schema` object:
   *
   * ```js
   * {
   *   // A singular value.
   *   name: { type: String },
   *
   *   // An array containing values of a single type.
   *   lucky_numbers: { type: Number, isArray: true },
   *
   *   // Creates a to-many link to 'animal' model. If the field `owner`
   *   // on the `animal` type is not an array, this is a many-to-one
   *   // relationship, otherwise it is many-to-many. If a link is defined,
   *   // then the inverse field must also be specified.
   *   pets: { link: 'animal', isArray: true, inverse: 'owner' },
   *
   *   // This is allowed. `min` and `max` keys are ignored, need to
   *   // introspect the schema to implement validation.
   *   thing: { type: Number, min: 0, max: 100 },
   *
   *   // Nested schema fields will not be recursed.
   *   nested: { thing: { ... } } // wrong
   * }
   * ```
   *
   * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
   * `Object`, `Buffer`.
   *
   * @param {String} name name of the model
   * @param {Object} schema definition object
   * @return this
   */
  model (name, schema) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot define new models after initialization.`)

    if (typeof name !== 'string')
      throw new TypeError(`Name must be a string.`)

    if (!name.length)
      throw new Error(`Name must be non-trivial.`)

    if (this.schemas.hasOwnProperty(name))
      throw new Error(`The model "${name}" was already defined.`)

    if (!(schema instanceof Object))
      throw new TypeError(`Schema for "${name}" must be an object.`)

    validate(schema)

    this.schemas[name] = schema

    // Memoize the current name, for chaining methods.
    this.currentModel = name

    return this
  }


  /**
   * Define a transformation per model type.
   *
   * A transform function takes at least two arguments, the internal `context`
   * object and a single `record`. The before transform may take an additional
   * argument, `update`, if the request is to update an record.
   *
   * There are two kinds of transform, before it is written to, and after it
   * isread from the data store, either is optional. It must return the second
   * argument `record` either synchronously, or asynchronously as a Promise.
   * If an error occurs within an transform function, it will be forwarded in
   * the response. Use typed errors to provide the appropriate feedback.
   * It is important to note that `after` transforms are run every time an
   * record is included in a response, so it should be idempotent.
   *
   * The context of a `before` transform will have values type-casted to
   * match the schema, and the context of an `after` transform should
   * already have values corresponding to the schema types.
   *
   * An example transform to apply a timestamp on a record before writing,
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
   * @param {String} [type]
   * @param {Function} [before]
   * @param {Function} [after]
   * @return this
   */
  transform (type, before, after) {
    if (arguments.length < 3) {
      before = arguments[0]
      after = arguments[1]
      type = this.currentModel
    }

    if (![ before, after ].filter(fn => typeof fn === 'function').length)
      throw new TypeError(`A function must be passed to transform.`)

    if (!this.schemas.hasOwnProperty(type))
      throw new Error(`Attempted to define transform on "${type}" ` +
        `model which does not exist.`)

    this.transforms[type] = {}

    if (typeof before === 'function')
      this.transforms[type].before = before

    if (typeof after === 'function')
      this.transforms[type].after = after

    return this
  }


  /**
   * Convenience method to define only the `before` argument of
   * a transform.
   *
   * @param {String} [type]
   * @param {Function} fn
   * @return this
   */
  before (type, fn) {
    if (arguments.length < 2) {
      fn = type
      type = this.currentModel
    }
    return this.transform(type, fn, null)
  }


  /**
   * Convenience method to define only the `after` argument of
   * a transform.
   *
   * @param {String} [type]
   * @param {Function} after
   * @return this
   */
  after (type, fn) {
    if (arguments.length < 2) {
      fn = type
      type = this.currentModel
    }
    return this.transform(type, null, fn)
  }


  /**
   * Set the adapter. The arguments mirror that of the constructor method's
   * options. This method may only be called before initialization.
   *
   * @param {Object} type
   * @param {Object} [options]
   * @return this
   */
  setAdapter (type, options) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot define adapter after initialization.`)

    this.options.adapter = { type, options }

    return this
  }


  /**
   * Add a serializer. The arguments mirror that of the constructor method's
   * options. This method may only be called before initialization. The
   * priority of serializers is given to the last method call. If this method
   * is called without defining serializers in the constructor, default
   * serializers will be omitted.
   *
   * @param {Object} type
   * @param {Object} [options]
   * @return this
   */
  addSerializer (type, options) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot define serializer after initialization.`)

    if (!this.options.hasOwnProperty('serializers'))
      this.options.serializers = []

    this.options.serializers.unshift({ type, options })

    return this
  }


  /**
   * An alternative to the constructor method.
   */
  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
Object.assign(Fortune, {
  adapters, serializers, net, errors
})


// Apply default options, for internal use.
function setDefaults () {
  const { options } = this

  if (!options.hasOwnProperty('adapter'))
    this.setAdapter(adapters.NeDB)

  if (!options.hasOwnProperty('serializers'))
    Object.keys(serializers).forEach(name => {
      this.addSerializer(serializers[name])
    })
}
