import Negotiator from 'negotiator'
import Fortune from '../'
import * as errors from '../common/errors'
import * as success from '../common/success'


const beforeSemicolon = /[^;]*/


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
  const spaces = options.json && 'spaces' in options.json ?
    options.json.spaces : 0
  const bufferEncoding = options.json && 'bufferEncoding' in options.json ?
    options.json.bufferEncoding : 'base64'

  // We can take advantage of the closure provided by the `http` wrapper
  // function which has a reference to the Fortune instance.
  return (request, response) => {
    const options = {
      // Using Negotiator to get the highest priority media type.
      serializerOutput: new Negotiator(request)
        .mediaType(instance.serializer.ids),

      // Get the media type of the request.
      // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
      serializerInput: beforeSemicolon
        .exec(request.headers['content-type'] || '')[0] || null,

      meta: request.headers
    }

    if (options.serializerOutput)
      response.setHeader('Content-Type', options.serializerOutput)

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
    const { payload, meta } = contextResponse

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
        contextResponse.payload = stringifyObject(payload)

      if (typeof contextResponse.payload === 'string')
        meta['Content-Length'] = Buffer.byteLength(contextResponse.payload)

      for (let field in meta)
        response.setHeader(field, meta[field])

      if (skipResponse) return resolve(contextResponse)

      try {
        response.end(contextResponse.payload, () => resolve(contextResponse))
      }
      catch (error) {
        const message = 'The response is malformed.'
        response.statusCode = http.statusMap.get(Error)
        response.setHeader('Content-Type', 'text/plain')
        response.setHeader('Content-Length', message.length)
        response.end(message, () => resolve(contextResponse))
      }
    })
  }
}


// Map successes and errors to HTTP status codes.
http.statusMap = new WeakMap([
  [ success.OK, 200 ],
  [ success.Created, 201 ],
  [ success.Empty, 204 ],
  [ errors.BadRequestError, 400 ],
  [ errors.UnauthorizedError, 401 ],
  [ errors.ForbiddenError, 403 ],
  [ errors.NotFoundError, 404 ],
  [ errors.MethodError, 405 ],
  [ errors.NotAcceptableError, 406 ],
  [ errors.ConflictError, 409 ],
  [ errors.UnsupportedError, 415 ],
  [ Error, 500 ]
])
