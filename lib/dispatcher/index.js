import { EventEmitter } from 'events'
import Serializer from '../serializer'
import * as stderr from '../common/stderr'
import * as errors from '../common/errors'
import * as middlewares from './middlewares'


const idempotentAction = 'find'
const changeEvent = 'change'

// Default flows corresponding to adapter actions.
const defaultFlows = {
  create: [ 'doCreate', 'fetchInclude', 'endRequest' ],
  find: [ 'showIndex', 'doFind', 'fetchInclude', 'endRequest' ],
  update: [ 'doUpdate', 'fetchInclude', 'endRequest' ],
  delete: [ 'doDelete', 'endRequest' ]
}


/**
 * Delegate I/O tasks to adapter and serializers. The dispatcher inherits
 * from the built-in `EventEmitter` object, and emits one event, the `change`
 * event. The argument it receives is an object with the keys `action`,
 * `type`, and `ids`. This may be useful for implementing real-time
 * updates.
 */
export default class Dispatcher extends EventEmitter {

  constructor (core, ...args) {
    super()

    Object.assign(this, {
      middlewares,
      flows: defaultFlows,
      schemas: core.schemas,
      transforms: core.transforms,
      adapter: core.adapter,
      serializer: core.serializer
    }, ...args)

    Object.defineProperty(this, 'changeEvent', {
      value: changeEvent
    })
  }

  /**
   * This is the primary method for initiating a workflow. It is decoupled
   * from network protocols. The request object must be formatted as follows:
   *
   * ```js
   * {
   *   // The default allowed values are `create`, `find`, `update`, or
   *   // `delete`, which correspond to the names of adapter methods.
   *   // To implement a custom action, define a new flow under `flows`,
   *   // and define middleware functions under `middlewares`.
   *   action: 'find',
   *
   *   type: undefined, // Name of a type.
   *   ids: [], // An array of IDs.
   *
   *   // A 2-dimensional array specifying links to include. The first
   *   // dimension is a list, the second dimension is depth. For example:
   *   // [['comments'], ['comments', 'author']]
   *   include: [],
   *
   *   // Exactly the same as the adapter's `find` method options.
   *   // The options apply only to the primary type.
   *   options: { ... },
   *
   *   // Same as `options`, but is an object keyed by type. This takes
   *   // precedence over `options`, and is used in conjunction with the
   *   // `include` option.
   *   optionsPerType: { [type]: { ... } },
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
      dispatchRequest.call(this, context, ...args)))
        .catch(error => {
          stderr.error(error)

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
 * A hash mapping action names to an array of middleware names. The
 * middlewares are executed serially. For example:
 *
 * ```js
 * { doNothing: ['noop', 'noop', 'noop'] }
 * ```
 */
Dispatcher.prototype.flows = {}


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} context
 * @param {*} [args]
 * @return {Promise}
 */
function dispatchRequest (context, ...args) {
  const { action, type, ids } = context.request
  const { middlewares, flows } = this
  const runFlow = (action, context) => {
    // Block invalid action.
    if (!(action in flows))
      throw new errors.MethodError(`The action type "${action}" ` +
        `is unrecognized.`)

    return flows[action].reduce((chain, name) => {
      const middleware = middlewares[name]

      return chain ? chain.then(context => middleware.call(this, context)) :
        Promise.resolve(middleware.call(this, context))
    }, null)
  }

  // Block request if type is invalid.
  if ((action !== idempotentAction || type) && !(type in this.schemas))
      throw new errors.NotFoundError(`The requested type "${type}" ` +
        `is not a valid type.`)

  // Make sure IDs are an array of unique values.
  context.request.ids = [...new Set(Array.isArray(ids) ? ids : [ids])]

  // Try to process the request.
  return Promise.resolve(this.serializer.processRequest(context, ...args))

    .then(context => runFlow(context.request.action, context)

    ).then(context =>
      Promise.resolve(this.serializer.processResponse(context, ...args))

    ).then(context => context.response)
}


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options = {}) {
  const context = {
    request: {
      action: 'find',
      type: undefined,
      ids: [],
      include: [],
      options: {
        filter: {},
        sort: {},
        fields: {},
        match: {},
        limit: 1000,
        offset: 0
      },
      optionsPerType: {},
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
