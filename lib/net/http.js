import Negotiator from 'negotiator'
import Fortune from '../'
import * as errors from '../common/errors'
import * as success from '../common/success'


/**
 * This function maps HTTP on to Fortune, it's a static method available at
 * `Fortune.net.http`. The only integration it has with Fortune is passing in
 * which serializers to use, and mapping the response from the `dispatch`
 * method on to the HTTP response. The listener function ends the response and
 * returns a promise that is resolved when the response is ended. The returned
 * promise may be rejected with the error response, providing a hook for error
 * logging.
 *
 * @param {Fortune} instance
 * @return {Function}
 */
export default function http (instance) {
  if (!(instance instanceof Fortune))
    throw new Error('An instance of Fortune is required.')

  // We can take advantage of the closure provided by the `http` wrapper
  // function which has a reference to the Fortune instance.
  return (request, response) => {
    // Delegates all handling of options to the serializers.
    const options = {
      // Using Negotiator to get the highest priority media type.
      serializerOutput: new Negotiator(request)
        .mediaType(instance.serializer.ids),

      // Get the media type of the request.
      // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
      serializerInput: (request.headers['content-type'] || '')
        .match(/[^;]*/)[0] || null
    }

    // Pass the options and system request/response objects to Fortune.
    return instance.dispatch(options, request, response)

    .then(end.bind(null, response), contextResponse =>
      end(response, contextResponse).then(() => {
        throw contextResponse
      }))
  }
}


// Internal function to end the response.
function end (response, contextResponse) {
  const { payload, meta } = contextResponse

  response.statusCode = http.statusMap.get(contextResponse.constructor) ||
    http.statusMap.get(Error)

  for (let field in meta)
    response.setHeader(field, meta[field])

  // The special `Connection` header notifies Node.js that the server
  // should be persisted. See: https://serverfault.com/questions/322683
  response.setHeader('Connection', 'keep-alive')

  return new Promise(resolve => {
    if (payload === null ||
    typeof payload === 'string' || Buffer.isBuffer(payload))
      return response.end(payload, resolve)

    response.statusCode = http.statusMap.get(Error)
    response.setHeader('Content-Type', 'text/plain')
    return response.end('The response is malformed.', resolve)
  })
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
