import * as success from '../common/success'
import * as errors from '../common/errors'

export { default as create } from './create'
export { default as delete } from './delete'
export { default as update } from './update'
export { default as find } from './find'
export { default as include } from './include'
export { default as end } from './end'


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} options
 * @param {...*} [args]
 * @return {Promise}
 */
export default function dispatch (options, ...args) {
  const { serializer: { processRequest, processResponse, showError },
    recordTypes, methods } = this
  const defaultMethod = methods.find
  let context = setDefaults(defaultMethod, options)

  // Start a promise chain.
  return Promise.resolve(context)

  // Try to process the request.
  .then(context => processRequest(context, ...args))

  .then(context => {
    const { method, type, ids } = context.request

    // Make sure that IDs are an array of unique, non-falsy values.
    if (ids) context.request.ids =
      [ ...new Set(Array.isArray(ids) ? ids : [ ids ]) ]
      .filter(id => id)

    // If a type is unspecified, block the request.
    if (type === null && method !== defaultMethod &&
    typeof method !== 'function')
      throw new errors.MethodError(`The type is unspecified.`)

    // If a type is specified and it doesn't exist, block the request.
    if (type !== null && !(type in recordTypes))
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
 * @param {Symbol} defaultMethod
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaults (defaultMethod, options) {
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
