'use strict'

import { OK, Created, Empty } from '../common/success'
import { BadRequestError, NotFoundError, MethodError,
  nativeErrors } from '../common/errors'

var promise = require('../common/promise')
var assign = require('../common/assign')
var constants = require('../common/constants')
var findMethod = constants.find
var createMethod = constants.create


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} scope
 * @param {Object} options
 * @param {*} [a]
 * @param {*} [b]
 * @return {Promise}
 */
function dispatch (scope, options, a, b) {
  const { serializer: { processRequest, processResponse, showError },
    flows, recordTypes } = scope
  var Promise = promise.Promise
  var context = setDefaults(options)

  // Start a promise chain.
  return Promise.resolve(context)

  // Try to process the request.
  .then(context => processRequest(context, a, b))

  .then(context => {
    const { method, type, ids } = context.request
    var chain, flow, i, l

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

    if (typeof method === 'function') return method(context)

    // Block invalid method.
    if (!(method in flows))
      throw new MethodError(`The method "${method}" is unrecognized.`)

    // Start the promise chain.
    chain = Promise.resolve(context)
    flow = flows[method]

    for (i = 0, l = flow.length; i < l; i++)
      chain = chain.then(flow[i])

    return chain
  })

  .then(context => processResponse(context, a, b))

  .then(context => {
    const { request: { method }, response: { payload }, response } = context

    if (method === createMethod) return new Created(response)
    if (!payload) return new Empty(response)

    return new OK(response)
  })

  .catch(error => Promise.resolve(
    showError(context, nativeErrors.has(error.constructor) ?
      new Error(`An internal server error occurred.`) : error))

    .then(context => Promise.resolve(processResponse(context, a, b)))

    .then(context => {
      throw assign(error, context.response)
    }))
}


// Re-exporting internal middlewares.
dispatch.middlewares = {
  create: require('./create'),
  'delete': require('./delete'),
  update: require('./update'),
  find: require('./find'),
  include: require('./include'),
  end: require('./end')
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

  assign(context.request, options)

  return context
}


module.exports = dispatch
