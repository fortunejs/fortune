import zlib from 'zlib'
import Negotiator from 'negotiator'
import Fortune from '../'
import { BadRequestError, UnauthorizedError, ForbiddenError,
  NotFoundError, MethodError, NotAcceptableError, ConflictError,
  UnsupportedError } from '../common/errors'
import { OK, Created, Empty } from '../common/success'


const beforeSemicolon = /[^;]*/
const availableEncodings = [ 'gzip', 'deflate' ]


/**
 * This function maps HTTP on to Fortune, it's a static method available at
 * `Fortune.net.http`. The integration with Fortune is minimal, passing in
 * which serializers to use, assigning request headers to the `meta` object,
 * and reading the request body, and mapping the response from the `request`
 * method on to the HTTP response. If the payload is an object, it will be cast
 * into a JSON string. The listener function ends the response and returns a
 * promise that is resolved when the response is ended. The returned promise
 * may be rejected with the error response, providing a hook for error logging.
 *
 * The options object may be formatted as follows:
 *
 * ```js
 * {
 *   // By default, the listener will end the response, set this to `true` if
 *   // the response will be ended later.
 *   skipResponse: false,
 *
 *   // Use compression if the request `Accept-Encoding` header allows it. Note
 *   // that Buffer-typed responses will not be compressed. This option should
 *   // be disabled in case of a reverse proxy which handles compression.
 *   compression: true,
 *
 *   // JSON specific settings.
 *   json: {
 *     // How many spaces to indent. For example, use `2` for pretty printing.
 *     spaces: 0,
 *
 *     // Character encoding for buffers.
 *     bufferEncoding: 'base64'
 *   }
 * }
 * ```
 *
 * @param {Fortune} instance
 * @param {Object} [options]
 * @return {Function}
 */
export default function http (instance, options = {}) {
  if (!(instance instanceof Fortune))
    throw new Error('An instance of Fortune is required.')

  const skipResponse = 'skipResponse' in options ?
    options.skipResponse : false
  const compression = 'compression' in options ?
    options.compression : true
  const spaces = options.json && 'spaces' in options.json ?
    options.json.spaces : 0
  const bufferEncoding = options.json && 'bufferEncoding' in options.json ?
    options.json.bufferEncoding : 'base64'

  // We can take advantage of the closure provided by the `http` wrapper
  // function which has a reference to the Fortune instance.
  return (request, response) => {
    const negotiator = new Negotiator(request)

    const options = {
      // Using Negotiator to get the highest priority media type.
      serializerOutput: negotiator.mediaType(instance.serializer.ids),

      // Get the media type of the request.
      // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
      serializerInput: beforeSemicolon
        .exec(request.headers['content-type'] || '')[0] || null,

      meta: request.headers
    }

    if (options.serializerOutput)
      response.setHeader('Content-Type', options.serializerOutput)

    if (compression) {
      const encoding = negotiator.encoding(availableEncodings)
      if (encoding) response.setHeader('Content-Encoding', encoding)
    }

    return new Promise((resolve, reject) => {
      const chunks = []

      request.on('error', error => {
        response.setHeader('Content-Type', 'text/plain')
        error.payload = 'The request body is invalid.'
        reject(error)
      })

      request.on('data', chunk => chunks.push(chunk))
      request.on('end', () => resolve(Buffer.concat(chunks)))
    })

    .then(body => {
      if (body.length) options.payload = body

      // Pass the options and system request/response objects to Fortune.
      return instance.request(options, request, response)
    })

    .then(end.bind(null, request, response), contextResponse =>
      end(request, response, contextResponse).then(() => {
        throw contextResponse
      }))
  }

  function stringifyObject (object) {
    return JSON.stringify(object, (key, value) => {
      // Duck type checking.
      if (value && value.type === 'Buffer' && Array.isArray(value.data))
        return new Buffer(value.data).toString(bufferEncoding)

      return value
    }, spaces)
  }

  // Internal function to end the response.
  function end (request, response, contextResponse) {
    let { payload, meta } = contextResponse

    response.statusCode = http.statusMap.get(contextResponse.constructor) ||
      http.statusMap.get(Error)

    // The special `Connection` header notifies Node.js that the server should
    // be persisted, unless explicitly specified otherwise.
    // See: https://serverfault.com/questions/322683
    const connection = request.headers['connection']
    if (!(connection && connection.toLowerCase() === 'close'))
      response.setHeader('Connection', 'keep-alive')

    return new Promise(resolve => {
      if (Buffer.isBuffer(payload))
        meta['Content-Length'] = payload.length

      else if (payload && typeof payload === 'object')
        payload = contextResponse.payload = stringifyObject(payload)

      if (typeof payload === 'string') {
        const encoding = response.getHeader('content-encoding')

        if (encoding && ~availableEncodings.indexOf(encoding))
          return zlib[encoding](payload, (error, result) => {
            if (error) throw error
            payload = contextResponse.payload = result
            meta['Content-Length'] = payload.length
            return resolve()
          })

        meta['Content-Length'] = Buffer.byteLength(payload)
        return resolve()
      }

      response.removeHeader('Content-Encoding')
      response.removeHeader('Content-Type')
      return resolve()
    })
    .then(() => new Promise(resolve => {
      for (let field in meta)
        response.setHeader(field, meta[field])

      return skipResponse ? resolve(contextResponse) :
        response.end(payload, () => resolve(contextResponse))
    }))
    .catch(error => new Promise(resolve => {
      const message = error.toString()
      response.statusCode = http.statusMap.get(Error)
      response.setHeader('Content-Type', 'text/plain')
      response.setHeader('Content-Length', Buffer.byteLength(message))
      response.end(message, () => resolve(error))
    }))
  }
}


// Map successes and errors to HTTP status codes.
http.statusMap = new WeakMap([
  [ OK, 200 ],
  [ Created, 201 ],
  [ Empty, 204 ],
  [ BadRequestError, 400 ],
  [ UnauthorizedError, 401 ],
  [ ForbiddenError, 403 ],
  [ NotFoundError, 404 ],
  [ MethodError, 405 ],
  [ NotAcceptableError, 406 ],
  [ ConflictError, 409 ],
  [ UnsupportedError, 415 ],
  [ Error, 500 ]
])
