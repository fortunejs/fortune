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
 * from the built-in `EventEmitter` object, and emits one event by default,
 * the `events.change` event. This may be useful for implementing real-time
 * notifications.
 *
 * **Change event** (`events.change`) - emitted when a change is done. The
 * callback function receives an object keyed by event symbols.
 */
export default class Dispatcher extends EventEmitter {

  constructor (core, ...args) {
    super()

    const { schemas, transforms, adapter, serializer } = core

    Object.assign(this, ...args, {
      events, schemas, transforms, adapter, serializer
    })

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
    this.middlewares = middlewares

    /**
     * A hash mapping method names to an array of middleware names. The
     * middlewares are executed serially. For example:
     *
     * ```js
     * { doNothing: ['noop', 'noop', 'noop'] }
     * ```
     */
    this.methods = methods
  }

}


/**
 * Internal function to dispatch a request.
 *
 * @param {Object} options
 * @param {...*} [args]
 * @return {Promise}
 */
export function dispatch (options, ...args) {
  let context = setDefaults(options)
  const { serializer, schemas } = this
  const { method, type, ids } = context.request
  const { processRequest, processResponse, showError } = serializer

  // Block request if type is invalid.
  if ((method !== idempotentMethod || type) && !(type in schemas))
      throw new errors.NotFoundError(`The requested type "${type}" ` +
        `is not a valid type.`)

  // Make sure IDs are an array of unique values.
  context.request.ids = ids ?
    [...new Set(Array.isArray(ids) ? ids : [ids])] : []

  // Try to process the request.
  return new Promise((resolve, reject) =>
    Promise.resolve(processRequest(context, ...args))
    .then(context => runMethod.call(this, context.request.method, context))
    .then(context => Promise.resolve(processResponse(context, ...args)))
    .then(context => resolve(context.response))
    .catch(error => {
      try {
        context = showError(context, error)
        context = processResponse(context)
      } catch (error) {
        Serializer.prototype.showError(context, error)
      }

      // If the error is actually an error, then augment the error with the
      // response object, or just create a new error.
      return reject(Object.assign(
        error instanceof Error ? error : new Error(error),
        context.response))
    }))
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
      method: idempotentMethod,
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
