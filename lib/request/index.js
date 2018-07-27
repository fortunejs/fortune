'use strict'

var promise = require('../common/promise')
var assign = require('../common/assign')
var unique = require('../common/array/unique')
var message = require('../common/message')

var responseClass = require('../common/response_classes')
var BadRequestError = responseClass.BadRequestError
var NotFoundError = responseClass.NotFoundError
var MethodError = responseClass.MethodError
var OK = responseClass.OK
var Empty = responseClass.Empty
var Created = responseClass.Created

var methods = require('../common/methods')
var findMethod = methods.find
var createMethod = methods.create


/*!
 * Internal function to send a request. Must be called in the context of
 * the Fortune instance.
 *
 * @param {Object} options
 * @return {Promise}
 */
function internalRequest (options) {
  var Promise = promise.Promise
  var flows = this.flows
  var recordTypes = this.recordTypes
  var adapter = this.adapter

  var context = setDefaults(options)
  var method = context.request.method
  var hasTransaction = 'transaction' in options

  // Start a promise chain.
  return Promise.resolve(context)

    .then(function (context) {
      var type = context.request.type
      var ids = context.request.ids
      var language = context.request.meta.language
      var error

      // Make sure that IDs are an array of unique values.
      if (ids) context.request.ids = unique(ids)

      // If a type is unspecified, block the request.
      if (type === null) {
        error = new BadRequestError(message('UnspecifiedType', language))
        error.isTypeUnspecified = true
        throw error
      }

      // If a type is specified and it doesn't exist, block the request.
      if (!recordTypes.hasOwnProperty(type))
        throw new NotFoundError(
          message('InvalidType', language, { type: type }))

      // Block invalid method.
      if (!(method in flows))
        throw new MethodError(
          message('InvalidMethod', language, { method: method }))

      return hasTransaction ?
        Promise.resolve(options.transaction) :
        adapter.beginTransaction()
    })

    .then(function (transaction) {
      var chain, flow, i, j

      context.transaction = transaction
      chain = Promise.resolve(context)
      flow = flows[method]

      for (i = 0, j = flow.length; i < j; i++)
        chain = chain.then(flow[i])

      return chain
    })

    .then(function (context) {
      return hasTransaction ?
        Promise.resolve() : context.transaction.endTransaction()
          .then(function () {
            var method = context.request.method
            var response = context.response
            var payload = response.payload

            if (!payload) return new Empty(response)
            if (method === createMethod) return new Created(response)

            return new OK(response)
          })
    })

  // This makes sure to call `endTransaction` before re-throwing the error.
    .catch(function (error) {
      return 'transaction' in context && !hasTransaction ?
        context.transaction.endTransaction(error)
          .then(throwError, throwError) :
        throwError()

      function throwError () {
        throw assign(error, context.response)
      }
    })
}


// Re-exporting internal middlewares.
internalRequest.middlewares = {
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
      options: {},
      include: [],
      meta: {},
      payload: null
    },
    response: {
      meta: {},
      payload: null
    }
  }

  assign(context.request, options)

  return context
}


module.exports = internalRequest
