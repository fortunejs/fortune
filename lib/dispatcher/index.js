import { EventEmitter } from 'events'
import Serializer from '../serializer'
import * as errors from '../common/errors'
import * as middlewares from './middlewares'
import * as events from '../common/events'


const idempotentMethod = events.find

// Default methods corresponding to adapter methods.
const methods = {
  [events.find]: [ 'showIndex', 'doFind', 'fetchInclude', 'endRequest' ],
  [events.create]: [ 'doCreate', 'fetchInclude', 'endRequest' ],
  [events.update]: [ 'doUpdate', 'fetchInclude', 'endRequest' ],
  [events.delete]: [ 'doDelete', 'endRequest' ]
}


/**
 * Delegate I/O tasks to adapter and serializers. The dispatcher inherits
 * from the built-in `EventEmitter` object, and emits one event, the `change`
 * event. The argument it receives is an object with the keys `method`,
 * `type`, and `ids`. This may be useful for implementing real-time
 * updates.
 */
export default class Dispatcher extends EventEmitter {

  constructor (core, ...args) {
    super()

    const { schemas, transforms, adapter, serializer } = core

    Object.assign(this, {
      events, middlewares, methods,
      schemas, transforms, adapter, serializer
    }, ...args)
  }

  /**
   * This is the primary method for initiating a workflow. It is decoupled
   * from network protocols. The request object must be formatted as follows:
   *
   * ```js
   * {
   *   // The method is a Symbol type, keyed under `events` and may be one of
   *   // `find`, `create`, `update`, or `delete`. To implement a custom
   *   // method, define a new method under `methods`, and define middleware
   *   // functions under `middlewares`.
   *   method: events.find,
   *
   *   type: undefined, // Name of a type.
   *   ids: [], // An array of IDs.
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
   *   // necessary for included records, and only used in conjunction with the
   *   // `include` option.
   *   includeOptions: { [type]: { ... } },
   *
   *   // The name of the serializer to use for the input (request).
   *   serializerInput: undefined,
   *
   *   // The name of the serializer to use for the output (response).
   *   serializerOutput: undefined,
   *
   *   meta: {}, // Meta-info of the request.
   *   payload: {} // Payload of the request.
   * }
   * ```
   *
   * The response object is wrapped in a `Promise`, and is much simpler:
   *
   * ```js
   * {
   *   meta: {}, // Meta-info of the response.
   *   payload: {} // Payload of the response.
   * }
   * ```
   *
   * If the request fails, the returned value of the promise should be the
   * corresponding `Error` object, augmented with the response object.
   *
   * @param {Object} options
   * @param {*} [args]
   * @return {Promise}
   */
  request (options, ...args) {
    let context = setDefaults(options)

    return new Promise(resolve => resolve(
      dispatchRequest.call(this, context, ...args)
    ))

    .catch(error => {
      const { serializer } = this

      try {
        context = serializer.showError(context, error)
        context = serializer.processResponse(context)
      } catch (error) {
        Serializer.prototype.showError(context, error)
      }

      // If the error is actually an error, then augment the error with the
      // response object, or just create a new error.
      return Promise.reject(Object.assign(
        error instanceof Error ? error : new Error(error),
        context.response))
    })
  }

}


/**
 * A hash mapping names to middleware functions. A middleware function
 * must be unbound (not an arrow function), and is run in the scope of
 * the dispatcher. It accepts one argument, the `context` object, and
 * returns the context as a value or a Promise. For example:
 *
 * ```js
 * { noop: function (context) { return Promise.resolve(context) } }
 * ```
 */
Dispatcher.prototype.middlewares = {}


/**
 * A hash mapping method names to an array of middleware names. The
 * middlewares are executed serially. For example:
 *
 * ```js
 * { doNothing: ['noop', 'noop', 'noop'] }
 * ```
 */
Dispatcher.prototype.methods = {}


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} context
 * @param {*} [args]
 * @return {Promise}
 */
function dispatchRequest (context, ...args) {
  const { serializer, schemas } = this
  const { method, type, ids } = context.request
  const { processRequest, processResponse } = serializer

  // Block request if type is invalid.
  if ((method !== idempotentMethod || type) && !(type in schemas))
      throw new errors.NotFoundError(`The requested type "${type}" ` +
        `is not a valid type.`)

  // Make sure IDs are an array of unique values.
  context.request.ids = ids ?
    [...new Set(Array.isArray(ids) ? ids : [ids])] : []

  // Try to process the request.
  return Promise.resolve(processRequest(context, ...args))
  .then(context => runMethod.call(this, context.request.method, context))
  .then(context => Promise.resolve(processResponse(context, ...args)))
  .then(context => context.response)
}


/**
 * Internal function to run a flow, must be bound to the dispatcher.
 *
 * @param {String} method
 * @param {Object} context
 * @return {Promise}
 */
function runMethod (method, context) {
  const { middlewares, methods } = this

  // Block invalid method.
  if (!(method in methods))
    throw new errors.MethodError(`The method type "${method}" ` +
      `is unrecognized.`)

  return compose(context, ...methods[method].map(name =>
    middlewares[name].bind(this)))
}


/**
 * Asynchronously compose functions that accept one argument and return either
 * a value or a Promise.
 *
 * @param {*} initialValue
 * @param {...Function} functions
 * @return {Promise}
 */
function compose (initialValue, ...functions) {
  return functions.reduce((chain, fn) =>
    chain === initialValue ? Promise.resolve(fn(initialValue)) :
    chain.then(value => fn(value)), initialValue)
}


/**
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options = {}) {
  const context = {
    request: {
      method: events.find,
      type: undefined,
      ids: [],
      options: {},
      include: [],
      includeOptions: {},
      serializerInput: undefined,
      serializerOutput: undefined,
      meta: {},
      payload: undefined
    },
    response: {
      meta: {},
      payload: undefined
    }
  }

  Object.assign(context.request, options)

  return context
}
