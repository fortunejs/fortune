import { EventEmitter } from 'events'
import defineArguments from '../common/define_arguments'
import * as errors from '../common/errors'
import * as methods from '../common/methods'
import * as success from '../common/success'
import * as middlewares from './middlewares'


const defaultMethod = methods.find

// Default flows.
const flows = Object.keys(methods).reduce((hash, method) =>
  Object.assign(hash, {
    [methods[method]]: [ middlewares[method],
      middlewares.include, middlewares.end ]
  }), {})

// Used for the change event.
const change = Symbol('change')


/**
 * Delegate I/O tasks to adapter and serializers. The dispatcher inherits
 * from the built-in `EventEmitter` object, and emits one event by default,
 * the `dispatcher.change` event. This may be useful for implementing real-time
 * notifications.
 */
export default class Dispatcher extends EventEmitter {

  constructor (dependencies, ...args) {
    super()

    const { schemas, transforms, adapter, serializer } = dependencies

    defineArguments.call(this, ...args, {
      methods, schemas, transforms, adapter, serializer
    })


    /**
     * A hash that maps method symbols to an array of middleware functions. The
     * middlewares are executed serially.
     */
    this.flows = Object.getOwnPropertySymbols(flows)
    .reduce((hash, method) =>
      Object.assign(hash, {
        [method]: flows[method].map(fn => fn.bind(this))
      }), {})

    /**
     * **Change event** (`dispatcher.change`) - emitted when a change is done.
     * The callback function receives an object keyed by event symbols.
     */
    this.change = change
  }

}


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} options
 * @param {...*} [args]
 * @return {Promise}
 */
export function dispatch (options, ...args) {
  const { serializer, schemas } = this
  const { processRequest, processResponse, showError } = serializer
  let context = setDefaults(options)

  // Start a promise chain.
  return Promise.resolve(context)

  // Try to process the request.
  .then(context => processRequest(context, ...args))

  .then(context => {
    const { method, type, ids } = context.request

    // Make sure IDs are an array of unique, non-falsy values.
    if (ids)
      context.request.ids =
        [ ...new Set(Array.isArray(ids) ? ids : [ ids ]) ]
        .filter(id => id)

    // If a type is unspecified, block the request.
    if (!type && method !== defaultMethod)
      throw new errors.MethodError(`The type is unspecified.`)

    // If a type is specified and it doesn't exist, block the request.
    if (type && !(type in schemas))
      throw new errors.NotFoundError(
        `The requested type "${type}" is not a valid type.`)

    return typeof method === 'function' ?
      method(context) : runMethod.call(this, method, context)
  })

  .then(context => processResponse(context, ...args))

  .then(context => {
    const { request, response } = context
    let Wrapper = success.OK

    if (request.method === methods.create)
      Wrapper = success.Created

    if (!response.payload)
      Wrapper = success.Empty

    return new Wrapper(response)
  })

  .catch(error => {
    context = showError(context, error)
    context = processResponse(context, ...args)

    // If the error is actually an error, then augment the error with the
    // response object, or just create a new error.
    throw Object.assign(
      error instanceof Error ? error : new Error(error),
      context.response)
  })
}


/*!
 * Internal function to run a flow, must be bound to the dispatcher.
 *
 * @param {String} method
 * @param {Object} context
 * @return {Promise}
 */
function runMethod (method, context) {
  const { flows } = this

  // Block invalid method.
  if (!(method in flows))
    throw new errors.MethodError(`The method type "${method}" ` +
      `is unrecognized.`)

  return compose(context, ...flows[method])
}


/*!
 * Asynchronously compose functions that accept one argument and return either
 * a value or a Promise.
 *
 * @param {*} initialValue
 * @param {...Function} functions
 * @return {Promise}
 */
function compose (initialValue, ...functions) {
  return functions.reduce((chain, fn) =>
    chain.then(value => fn(value)),
    Promise.resolve(initialValue))
}


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaults (options) {
  // Freeze the top level object, so that only the `request` and `response`
  // objects may exist and can not be redefined.
  const context = Object.freeze({
    request: {
      method: defaultMethod,
      type: null,
      ids: null,
      options: {},
      include: [],
      includeOptions: {},
      serializerInput: null,
      serializerOutput: null,
      meta: {},
      payload: null
    },
    response: {
      meta: {},
      payload: null
    }
  })

  Object.assign(context.request, options)

  return context
}
