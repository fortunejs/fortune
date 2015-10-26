'use strict'

var promise = require('../common/promise')
var assign = require('../common/assign')
var unique = require('../common/array/unique')

var responseClass = require('../common/response_classes')
var BadRequestError = responseClass.BadRequestError
var NotFoundError = responseClass.NotFoundError
var MethodError = responseClass.MethodError
var nativeErrors = responseClass.nativeErrors
var OK = responseClass.OK
var Empty = responseClass.Empty
var Created = responseClass.Created

var methods = require('../common/methods')
var findMethod = methods.find
var createMethod = methods.create


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
  var processRequest = scope.serializer.processRequest
  var processResponse = scope.serializer.processResponse
  var showError = scope.serializer.showError
  var flows = scope.flows
  var recordTypes = scope.recordTypes
  var Promise = promise.Promise
  var context = setDefaults(options)

  // Start a promise chain.
  return Promise.resolve(context)

  // Try to process the request.
  .then(function (context) { return processRequest(context, a, b) })

  .then(function (context) {
    var method = context.request.method
    var type = context.request.type
    var ids = context.request.ids
    var chain, flow, i, l

    // Make sure that IDs are an array of unique values.
    if (ids) context.request.ids =
      unique((Array.isArray(ids) ? ids : [ ids ]))

    // If a type is unspecified, block the request.
    if (type === null && method !== findMethod &&
    typeof method !== 'function')
      throw new BadRequestError('The type is unspecified.')

    // If a type is specified and it doesn't exist, block the request.
    if (type !== null && !recordTypes[type])
      throw new NotFoundError(
        'The requested type "' + type + '" is not a valid type.')

    if (typeof method === 'function') return method(context)

    // Block invalid method.
    if (!flows[method])
      throw new MethodError('The method "' + method + '" is unrecognized.')

    chain = Promise.resolve(context)
    flow = flows[method]

    for (i = 0, l = flow.length; i < l; i++)
      chain = chain.then(flow[i])

    return chain
  })

  .then(function (context) { return processResponse(context, a, b) })

  .then(function (context) {
    var method = context.request.method
    var response = context.response
    var payload = response.payload

    if (method === createMethod) return new Created(response)
    if (!payload) return new Empty(response)

    return new OK(response)
  })

  .catch(function (error) {
    return showError(context, ~nativeErrors.indexOf(error.constructor) ?
        new Error('An internal server error occurred.') : error)
    .then(function process (context) {
      return processResponse(context, a, b)
    }, function (error) {
      throw assign(error, context.response)
    })
    .then(function (context) {
      throw assign(error, context.response)
    })
  })
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
  var context = {
    request: {
      method: findMethod,
      type: null,
      ids: null,
      options: Object.create(null),
      include: [],
      includeOptions: Object.create(null),
      serializerInput: null,
      serializerOutput: null,
      meta: Object.create(null),
      payload: null
    },
    response: {
      meta: Object.create(null),
      payload: null
    }
  }

  assign(context.request, options)

  return context
}


module.exports = dispatch
