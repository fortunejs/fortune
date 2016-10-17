'use strict'

var assign = require('../common/assign')
var initializeContext = require('./http_initialize_context')


/**
 * **Node.js only**: `HttpSerializer` is an abstract base class containing
 * methods to be implemented.
 */
function HttpSerializer (properties) {
  assign(this, properties)
}


/**
 * The `HttpSerializer` should not be instantiated directly, since the
 * constructor function accepts dependencies. The keys which are injected are:
 *
 * - `methods`: same as static property on Fortune class.
 * - `errors`: same as static property on Fortune class.
 * - `keys`: an object which enumerates reserved constants for record type
 * definitions.
 * - `recordTypes`: an object which enumerates record types and their
 * definitions.
 * - `castValue`: a function with the signature (`value`, `type`, `options`),
 * useful for casting arbitrary values to a particular type.
 * - `options`: the options passed to the serializer.
 * - `adapter`: a reference to the adapter instance.
 * - `message`: a function with the signature (`id`, `language`, `data`).
 * - `Promise`: the Promise implementation.
 * - `settings`: settings from the Fortune instance.
 * - `documentation`: documentation from the Fortune instance.
 *
 * These keys are accessible on the instance (`this`).
 */
HttpSerializer.prototype.constructor = function () {
  // This exists here only for documentation purposes.
}

delete HttpSerializer.prototype.constructor


/**
 * This method is run first, and it is optional to implement. The default
 * implementation is typically used so that it may interoperate with other
 * serializers. The purpose is typically to read and mutate the request
 * before anything else happens. For example, it can handle URI routing and
 * query string parsing. The arguments that it accepts beyond the required
 * `contextRequest` are the `request` and `response` arguments from the Node.js
 * HTTP listener.
 *
 * It should return either the context request or a promise that resolves to
 * the context request. *The expectation is that the request is mutated except
 * for the payload*, which should be handled separately.
 *
 * @param {Object} contextRequest
 * @param {Object} request
 * @param {Object} response
 * @return {Promise|Object}
 */
HttpSerializer.prototype.processRequest = function () {
  // This is a no-op for documentation purposes.
}

// This is the real function call.
HttpSerializer.prototype.processRequest = initializeContext


/**
 * This gets run last. The purpose is typically to read and mutate the response
 * at the very end, for example, stringifying an object to be sent over the
 * network. The arguments that it accepts beyond the required `contextResponse`
 * are the `request` and `response` arguments from the Node.js HTTP listener.
 *
 * It should return either the context response or a promise that resolves to
 * the context response. *The expectation is that there is a key on the
 * context response, `payload`, which is either a string or a buffer*, or else
 * Node.js doesn't know how to respond.
 *
 * @param {Object} contextResponse
 * @param {Object} request
 * @param {Object} response
 * @return {Promise|Object}
 */
HttpSerializer.prototype.processResponse = function (contextResponse) {
  return contextResponse
}


/**
 * Parse a request payload for creating or updating records. This method should
 * return either an array of records as expected from the `adapter.create`
 * method, or an array of update object as expected from the `adapter.update`.
 * method. It may also mutate the context request object.
 *
 * @param {Object} contextRequest
 * @param {Object} request
 * @param {Object} response
 * @return {Promise|Object[]}
 */
HttpSerializer.prototype.parsePayload = function () {
  return []
}


/**
 * A serializer must have a static property `mediaType`, which **MUST** be a
 * string.
 */
HttpSerializer.mediaType = null


module.exports = HttpSerializer
