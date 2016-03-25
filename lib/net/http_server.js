'use strict'

var zlib = require('zlib')
var Negotiator = require('negotiator')
var Fortune = require('../core')
var promise = require('../common/promise')

var errors = require('../common/errors')
var BadRequestError = errors.BadRequestError
var UnsupportedError = errors.UnsupportedError
var NotAcceptableError = errors.NotAcceptableError
var nativeErrors = errors.nativeErrors

var assign = require('../common/assign')
var keys = require('../common/keys')
var methods = require('../common/methods')
var castValue = require('../common/cast_value')
var message = require('../common/message')

var HttpSerializer = require('./http_serializer')
var jsonSerializer = require('./http_json_serializer')
var htmlSerializer = require('./http_html_serializer')
var HttpFormSerializer = require('./http_form_serializer')
var initializeContext = require('./http_initialize_context')
var encodeRoute = require('./http_encode_route')

var responseClass = require('../common/response_classes')
var beforeSemicolon = /[^;]*/
var availableEncodings = [ 'gzip', 'deflate' ]

var statusMap = new WeakMap([
  [ Error, 500 ],
  [ responseClass.UnsupportedError, 415 ],
  [ responseClass.ConflictError, 409 ],
  [ responseClass.NotAcceptableError, 406 ],
  [ responseClass.MethodError, 405 ],
  [ responseClass.NotFoundError, 404 ],
  [ responseClass.ForbiddenError, 403 ],
  [ responseClass.UnauthorizedError, 401 ],
  [ responseClass.BadRequestError, 400 ],
  [ responseClass.Empty, 204 ],
  [ responseClass.Created, 201 ],
  [ responseClass.OK, 200 ]
])


/**
 * This function implements a HTTP server for Fortune, it's a static method
 * available at `Fortune.net.http`. The integration with Fortune is minimal,
 * determining which serializer to use, assigning request headers to the `meta`
 * object, and reading the request body, and mapping the response from the
 * `request` method on to the HTTP response. The listener function ends the
 * response and returns a promise that is resolved when the response is ended.
 * The returned promise may be rejected with the error response, providing a
 * hook for error logging.
 *
 * The options object may be formatted as follows:
 *
 * ```js
 * {
 *   // An array of HTTP serializers, ordered by priority. Defaults to ad hoc
 *   // JSON and form serializers if none are specified. If a serializer value
 *   // is not an array, its settings will be considered omitted.
 *   serializers: [
 *     [
 *       // A function that subclasses the HTTP Serializer.
 *       HttpSerializerSubclass,
 *
 *       // Settings to pass to the constructor, optional.
 *       { ... }
 *     ]
 *   ],
 *   settings: {
 *     // By default, the listener will end the response, set this to `false`
 *     // if the response will be ended later.
 *     endResponse: true,
 *
 *     // Use compression if the request `Accept-Encoding` header allows it.
 *     // Note that Buffer-typed responses will not be compressed. This option
 *     // should be disabled in case of a reverse proxy which handles
 *     // compression.
 *     compression: true
 *   }
 * }
 * ```
 *
 * The `http` function object contains the following keys:
 *
 * - `Serializer`: HTTP Serializer class.
 * - `JsonSerializer`: JSON over HTTP serializer.
 * - `FormDataSerializer`: Serializer for `multipart/formdata`.
 * - `FormUrlEncodedSerializer`: Serializer for
 *   `application/x-www-form-urlencoded`.
 * - `statusMap`: A `WeakMap` keyed by response class, valued by status code.
 *
 * @param {Fortune} instance
 * @param {Object} [options]
 * @return {Function}
 */
function http (instance, options) {
  var Promise = promise.Promise
  var i, j, input, CustomSerializer, mediaType,
    settings, endResponse, compression
  var mediaTypes = []
  var serializers = {}

  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  if (options === void 0) options = {}
  if (!('serializers' in options))
    options.serializers = [
      jsonSerializer(HttpSerializer),
      htmlSerializer(HttpSerializer),
      HttpFormSerializer.formData,
      HttpFormSerializer.formUrlEncoded
    ]
  if (!('settings' in options)) options.settings = {}
  settings = options.settings

  if (!options.serializers.length)
    throw new Error('At least one serializer must be defined.')

  for (i = 0, j = options.serializers.length; i < j; i++) {
    input = Array.isArray(options.serializers[i]) ?
      options.serializers[i] : [ options.serializers[i] ]

    if (typeof input[0] !== 'function')
      throw new TypeError('The HTTP serializer must be a function.')

    CustomSerializer = HttpSerializer.prototype
      .isPrototypeOf(input[0].prototype) ? input[0] : input[0](HttpSerializer)

    if (!HttpSerializer.prototype.isPrototypeOf(CustomSerializer.prototype))
      throw new TypeError('The serializer must inherit the HttpSerializer ' +
        'class.')

    mediaType = CustomSerializer.mediaType

    if (typeof mediaType !== 'string')
      throw new TypeError('A media type must be defined as a string for the ' +
        'HttpSerializer.')

    serializers[mediaType] = new CustomSerializer({
      methods: methods,
      errors: errors,
      keys: keys,
      recordTypes: instance.recordTypes,
      castValue: castValue,
      initializeContext: initializeContext,
      encodeRoute: encodeRoute,
      options: input[1] || {},
      adapter: instance.adapter,
      message: message,
      Promise: Promise
    })

    mediaTypes.push(mediaType)
  }

  endResponse = 'endResponse' in settings ? settings.endResponse : true
  compression = 'compression' in settings ? settings.compression : true

  // We can take advantage of the closure provided by the `http` wrapper
  // function which has a reference to the Fortune instance.
  return function (request, response) {
    var encoding, payload, isProcessing, contextResponse
    var negotiator = new Negotiator(request)
    var language = negotiator.language()

    // Using Negotiator to get the highest priority media type.
    var serializerOutput = negotiator.mediaType(mediaTypes)

    // Get the media type of the request.
    // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
    var serializerInput = beforeSemicolon
      .exec(request.headers['content-type'] || '')[0] || null

    var contextRequest = {
      meta: { headers: request.headers, language: language }
    }

    // Invalid media type requested. The `undefined` return value comes from
    // the Negotiator library.
    if (serializerOutput === void 0)
      serializerOutput = negotiator.mediaType()
    else response.setHeader('Content-Type', serializerOutput)

    if (compression) {
      encoding = negotiator.encoding(availableEncodings)
      if (encoding) response.setHeader('Content-Encoding', encoding)
    }

    // Set status code to null value, which we can check later if status code
    // should be overwritten or not.
    response.statusCode = null

    return new Promise(function (resolve, reject) {
      var chunks = []

      request.on('error', function (error) {
        response.setHeader('Content-Type', 'text/plain')
        error.payload = message('InvalidBody', language)
        error.isInputError = true
        reject(error)
      })

      request.on('data', function (chunk) { chunks.push(chunk) })
      request.on('end', function () { resolve(Buffer.concat(chunks)) })
    })

    .then(function (body) {
      if (body.length) payload = body

      if (!(serializerOutput in serializers))
        throw new NotAcceptableError(message(
          'SerializerNotFound', language, { id: serializerOutput }))

      return serializers[serializerOutput]
        .processRequest(contextRequest, request, response)
    })

    .then(function (contextRequest) {
      if (!serializerInput) return contextRequest

      if (!(serializerInput in serializers))
        throw new UnsupportedError(message(
          'SerializerNotFound', language, { id: serializerInput }))

      contextRequest.payload = payload

      return Promise.resolve()
      .then(function () {
        return payload && payload.length ?
          serializers[serializerInput].parsePayload(contextRequest) : null
      })
      .then(function (payload) {
        contextRequest.payload = payload
        return contextRequest
      }, function (error) {
        error.isInputError = true
        throw error
      })
    })

    .then(function (contextRequest) {
      return instance.request(contextRequest)
    })

    .then(function (result) {
      contextResponse = result
      isProcessing = true

      return serializers[serializerOutput]
        .processResponse(contextResponse, request, response)
    })

    .then(function (contextResponse) {
      return end(contextResponse, request, response)
    })

    .catch(function (error) {
      return Promise.resolve()
      .then(function () {
        var exposedError = error

        if (!('payload' in error) &&
          ~nativeErrors.indexOf(error.constructor)) {
          if (contextResponse) delete contextResponse.payload
          exposedError = assign(error.isInputError ?
            new BadRequestError(message('InvalidBody', language)) :
            new Error(message('GenericError', language)),
            contextResponse)
        }

        return !isProcessing && serializerOutput in serializers ?
          serializers[serializerOutput]
            .processResponse(exposedError, request, response) :
          exposedError
      })
      .then(function (error) {
        return end(error, request, response)
      }, function () {
        return end(new Error(message('GenericError', language)),
          request, response)
      })
      .then(function () {
        // Do not reject exceptions that result in non-error status codes.
        if (response.statusCode < 400) return error

        throw error
      })
    })
  }

  // Internal function to end the response.
  function end (contextResponse, request, response) {
    var encoding, payload, meta
    var connection = request.headers['connection']

    if (!('meta' in contextResponse)) contextResponse.meta = {}
    if (!('headers' in contextResponse.meta)) contextResponse.meta.headers = {}
    meta = contextResponse.meta
    payload = contextResponse.payload

    if (response.statusCode === null)
      response.statusCode = http.statusMap.get(contextResponse.constructor) ||
        http.statusMap.get(Error)

    // The special `Connection` header notifies Node.js that the server should
    // be persisted, unless explicitly specified otherwise.
    // See: https://serverfault.com/questions/322683
    if (!(connection && connection.toLowerCase() === 'close'))
      response.setHeader('Connection', 'keep-alive')

    return new Promise(function (resolve, reject) {
      if (contextResponse instanceof Error && !payload)
        return reject(contextResponse)

      // Don't try to compress buffers.
      if (Buffer.isBuffer(payload)) {
        response.removeHeader('Content-Encoding')
        meta.headers['Content-Length'] = payload.length
        return resolve()
      }

      else if (typeof payload === 'string') {
        encoding = response.getHeader('Content-Encoding')

        if (encoding && ~availableEncodings.indexOf(encoding))
          return zlib[encoding](payload, function (error, result) {
            if (error) throw error
            payload = contextResponse.payload = result
            meta.headers['Content-Length'] = payload.length
            return resolve()
          })

        response.removeHeader('Content-Encoding')
        payload = contextResponse.payload = new Buffer(payload)
        meta.headers['Content-Length'] = payload.length
        return resolve()
      }

      if (payload) {
        response.statusCode = http.statusMap.get(Error)
        return reject(new Error('Response payload type is invalid.'))
      }

      // Handle empty response.
      response.removeHeader('Content-Encoding')
      response.removeHeader('Content-Type')
      if (response.statusCode === http.statusMap.get(responseClass.OK))
        response.statusCode = (http.statusMap.get(responseClass.Empty))
      contextResponse.payload = ''
      return resolve()
    })
    .then(function () {
      return new Promise(function (resolve) {
        var field

        for (field in meta.headers)
          response.setHeader(field, meta.headers[field])

        return endResponse ?
          response.end(payload, function () { resolve(contextResponse) }) :
          resolve(contextResponse)
      })
    })
    .catch(function (error) {
      return new Promise(function (resolve) {
        var message = error.toString()
        if (response.statusCode == null)
          response.statusCode = http.statusMap.get(Error)
        response.removeHeader('Content-Encoding')
        response.setHeader('Content-Type', 'text/plain')
        response.setHeader('Content-Length', Buffer.byteLength(message))
        response.end(message, function () { resolve(error) })
      })
    })
  }
}


// Map successes and errors to HTTP status codes.
http.statusMap = statusMap


// Expose HTTP Serializer class, and defaults.
http.Serializer = HttpSerializer
http.JsonSerializer = jsonSerializer(HttpSerializer)
http.FormDataSerializer = HttpFormSerializer.formData
http.FormUrlEncodedSerializer = HttpFormSerializer.formUrlEncoded


module.exports = http
