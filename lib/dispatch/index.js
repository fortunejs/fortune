import compose from 'promise-compose'
import { create as createMethod,
  find as findMethod } from '../common/methods'
import { OK, Created, Empty } from '../common/success'
import { BadRequestError, NotFoundError, MethodError,
  nativeErrors } from '../common/errors'

export { default as create } from './create'
export { default as delete } from './delete'
export { default as update } from './update'
export { default as find } from './find'
export { default as include } from './include'
export { default as end } from './end'


// Set Promise shim if needed.
compose.Promise = Promise


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} options
 * @param {...*} [args]
 * @return {Promise}
 */
export default function dispatch (options, ...args) {
  const { serializer: { processRequest, processResponse, showError },
    recordTypes } = this
  let context = setDefaults(options)

  // Start a promise chain.
  return Promise.resolve(context)

  // Try to process the request.
  .then(context => processRequest(context, ...args))

  .then(context => {
    const { method, type, ids } = context.request

    // Make sure that IDs are an array of unique, non-falsy values.
    if (ids) context.request.ids =
      [ ...new Set((Array.isArray(ids) ? ids : [ ids ]).filter(id => id)) ]

    // If a type is unspecified, block the request.
    if (type === null && method !== findMethod &&
    typeof method !== 'function')
      throw new BadRequestError(`The type is unspecified.`)

    // If a type is specified and it doesn't exist, block the request.
    if (type !== null && !(type in recordTypes))
      throw new NotFoundError(
        `The requested type "${type}" is not a valid type.`)

    return typeof method === 'function' ?
      method(context) : runMethod.call(this, method, context)
  })

  .then(context => processResponse(context, ...args))

  .then(context => {
    const { request: { method }, response: { payload }, response } = context

    if (method === createMethod) return new Created(response)
    if (!payload) return new Empty(response)

    return new OK(response)
  })

  .catch(error => Promise.resolve(
    showError(context, nativeErrors.has(error.constructor) ?
      new Error(`An internal server error occurred.`) : error))

    .then(context => Promise.resolve(processResponse(context, ...args)))

    .then(context => {
      throw Object.assign(error, context.response)
    }))
}


/*!
 * Internal function to run a flow, must be bound to an instance.
 *
 * @param {String} method
 * @param {Object} context
 * @return {Promise}
 */
function runMethod (method, context) {
  const { flows } = this

  // Block invalid method.
  if (!(method in flows))
    throw new MethodError(`The method "${method}" is unrecognized.`)

  return compose(...flows[method])(context)
}


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaults (options) {
  const context = Object.freeze({
    request: {
      method: findMethod,
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
