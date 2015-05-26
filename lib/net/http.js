import Negotiator from 'negotiator'
import * as errors from '../common/errors'
import * as success from '../common/success'


/**
 * This function maps HTTP on to Fortune. The only integration it has with
 * Fortune is passing which serializers to use, and mapping the response from
 * the `dispatch` method on to the HTTP response. The `response.end` method
 * gets called, and this function returns a Promise when the response stream
 * is finished. It must be bound to a Fortune instance.
 *
 * Usage example:
 *
 * ```js
 * import http from 'http'
 * import fortune from 'fortune'
 *
 * const app = fortune.create()
 * const listener = fortune.net.http.bind(app)
 * const server = http.createServer(listener)
 * ```
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Promise}
 */
export default function http (request, response) {
  // Delegates all handling of options to the serializers.
  const options = {
    // Using Negotiator to get the highest priority media type.
    serializerOutput: new Negotiator(request)
      .mediaType(this.serializer.ids),

    // Get the media type of the request.
    // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
    serializerInput: (request.headers['content-type'] || '')
      .match(/[^;]*/)[0] || undefined
  }

  // Pass the options and system request/response objects to Fortune.
  return this.dispatch(options, ...arguments)
    .then(end, contextResponse => end(contextResponse)
    .then(() => { throw contextResponse }))

  // Internal function to end the response.
  function end (contextResponse) {
    const { payload, meta } = contextResponse

    response.statusCode = http.statusMap.get(contextResponse.constructor) ||
      http.statusMap.get(Error)

    for (let field in meta)
      response.setHeader(field, meta[field])

    return new Promise(resolve => {
      if (!payload || Buffer.isBuffer(payload) || typeof payload === 'string')
        return response.end(payload, resolve)

      response.statusCode = http.statusMap.get(Error)
      response.setHeader('Content-Type', 'text/plain')
      return response.end('The response is malformed.', resolve)
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
