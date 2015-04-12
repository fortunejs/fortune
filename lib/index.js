// local modules
import AdapterSingleton from './adapter/singleton'
import SerializerSingleton from './serializer/singleton'
import Dispatcher from './dispatcher'
import validate from './schema/validate'
import checkSchemas from './schema/check_schemas'
import * as stderr from './common/stderr'

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
   *   adapter: {
   *     // Must be a class that extends `Fortune.Adapter`, or a function
   *     // that accepts one argument, the Adapter class, and returns a
   *     // subclass. Required.
   *     // Default: NeDB
   *     type: function (Adapter) { ... },
   *
   *     // An options object that is specific to the adapter.
   *     // Default: undefined
   *     options: {}
   *   },
   *
   *   // An array of objects ordered by priority.
   *   // Default: [{id: 'application/vnd.api+json', type: [Serializer]}]
   *   serializers: [{
   *     // The ID should be informative and unique, such as corresponding
   *     // to a `Content-Type` for HTTP.
   *     id: 'application/vnd.api+json',
   *
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
   * @param {Object} options
   */
  constructor (options) {
    Object.defineProperties(this, {
      // 0 = not started, 1 = started, 2 = done.
      initializationStatus: { writable: true, value: 0 },
      currentModel: { writable: true, value: undefined },
      options: { value: setDefaults(options) },
      transforms: { value: {} },
      schemas: { value: {} }
    })

    // The singletons are responsible for extracting options and
    // dependencies, and doing dependency injection.
    this.adapter = new AdapterSingleton(this)
    this.serializer = new SerializerSingleton(this)
    this.dispatcher = new Dispatcher(this)
  }


  /**
   * This method must be called when model definition is done. It prevents
   * models from being defined after this method is called. The resolved value
   * is the instance of Fortune.
   *
   * @return {Promise}
   */
  initialize () {
    if (this.initializationStatus !== 0) {
      stderr.warn(`The \`initialize\` method should only be ` +
        `called once.`)
      return Promise.resolve(this)
    }

    return new Promise((resolve, reject) => {
      checkSchemas(this.schemas)

      this.initializationStatus = 1

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
   * Define a model given a schema definition and database options.
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
   * @param {String} type name of the model
   * @param {Object} schema definition object
   * @return this
   */
  model (type, schemaDefinition, options) {
    if (typeof type !== 'string' || !type.length)
      return stderr.warn(`Model must have a name.`)

    if (typeof schemaDefinition !== 'object')
      return stderr.warn(`Schema for "${type}" must be an object.`)

    if (this.initializationStatus !== 0)
      return stderr.warn(`Cannot define new models after initialization.`)

    if (this.schemas.hasOwnProperty(type))
      return stderr.warn(`The model "${type}" was already defined.`)

    this.schemas[type] = validate(schemaDefinition, options, type)

    // Memoize the current type, for chaining methods.
    this.currentModel = type

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

    if (![before, after].filter(fn => typeof fn === 'function').length)
      return stderr.warn(`A function must be passed to transform.`)

    if (!this.schemas.hasOwnProperty(type))
      return stderr.warn(`Attempted to define transform on "${type}" ` +
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


/*!
 * Default settings, for internal use.
 *
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaults (options) {
  const defaults = {}

  if (!(options instanceof Object))
    throw new Error(`Options must be an object.`)

  if (!options.hasOwnProperty('adapter'))
    defaults.adapter = {
      type: adapters.NeDB
    }

  if (!options.hasOwnProperty('serializers'))
    defaults.serializers = [{
      id: 'application/vnd.api+json',
      type: serializers.JSON_API
    }]

  return Object.assign(defaults, options)
}
