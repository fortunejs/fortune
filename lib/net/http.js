'use strict'

var zlib = require('zlib')
var Negotiator = require('negotiator')
var Fortune = require('../core')
var promise = require('../common/promise')

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
 * This function maps HTTP on to Fortune, it's a static method available at
 * `Fortune.net.http`. The integration with Fortune is minimal, passing in
 * which serializers to use, assigning request headers to the `meta` object,
 * and reading the request body, and mapping the response from the `request`
 * method on to the HTTP response. The listener function ends the response and
 * returns a promise that is resolved when the response is ended. The returned
 * promise may be rejected with the error response, providing a hook for error
 * logging.
 *
 * The options object may be formatted as follows:
 *
 * ```js
 * {
 *   // By default, the listener will end the response, set this to `false` if
 *   // the response will be ended later.
 *   endResponse: true,
 *
 *   // Use compression if the request `Accept-Encoding` header allows it. Note
 *   // that Buffer-typed responses will not be compressed. This option should
 *   // be disabled in case of a reverse proxy which handles compression.
 *   compression: true
 * }
 * ```
 *
 * @param {Fortune} instance
 * @param {Object} [options]
 * @return {Function}
 */
function http (instance, options) {
  var Promise = promise.Promise
  var endResponse, compression

  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  if (options === void 0) options = {}

  endResponse = 'endResponse' in options ? options.endResponse : true
  compression = 'compression' in options ? options.compression : true

  // We can take advantage of the closure provided by the `http` wrapper
  // function which has a reference to the Fortune instance.
  return function (request, response) {
    var encoding
    var negotiator = new Negotiator(request)
    var language = negotiator.language()

    var options = {
      // Using Negotiator to get the highest priority media type.
      serializerOutput: negotiator.mediaType(instance.serializer.ids),

      // Get the media type of the request.
      // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
      serializerInput: beforeSemicolon
        .exec(request.headers['content-type'] || '')[0] || null,

      meta: { headers: request.headers, language: language }
    }

    // Invalid media type requested. The `undefined` return value comes from
    // the Negotiator library.
    if (options.serializerOutput === void 0)
      options.serializerOutput = negotiator.mediaType()
    else response.setHeader('Content-Type', options.serializerOutput)

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
        reject(error)
      })

      request.on('data', function (chunk) { chunks.push(chunk) })
      request.on('end', function () { resolve(Buffer.concat(chunks)) })
    })

    .then(function (body) {
      if (body.length) options.payload = body

      // Pass the options and system request/response objects to Fortune.
      return instance.request(options, request, response)
    })

    .then(function (contextResponse) {
      return end(request, response, contextResponse, false)
    }, function (contextResponse) {
      return end(request, response, contextResponse, true)
      .then(function () { throw contextResponse })
    })
  }

  // Internal function to end the response.
  function end (request, response, contextResponse, isError) {
    var encoding
    var payload = contextResponse.payload
    var meta = contextResponse.meta
    var connection = request.headers['connection']

    if (!('headers' in meta)) meta.headers = {}

    if (response.statusCode === null)
      response.statusCode = http.statusMap.get(contextResponse.constructor) ||
        http.statusMap.get(Error)

    // The special `Connection` header notifies Node.js that the server should
    // be persisted, unless explicitly specified otherwise.
    // See: https://serverfault.com/questions/322683
    if (!(connection && connection.toLowerCase() === 'close'))
      response.setHeader('Connection', 'keep-alive')

    return new Promise(function (resolve) {
      if (isError && !payload) throw contextResponse

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
        throw new Error('Response payload type is invalid.')
      }

      response.removeHeader('Content-Encoding')
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


module.exports = http
