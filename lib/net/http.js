import Negotiator from 'negotiator'
import statusMap from './status_map'


/**
 * This function maps HTTP on to Fortune. The only integration it has with
 * Fortune is passing which serializers to use, and mapping the response
 * from the `dispatch` method on to the HTTP response. The `response.end`
 * method gets called, and this function returns a Promise when the
 * response stream is finished.
 *
 * Usage example:
 *
 * ```js
 * import http from 'http'
 * import Fortune from 'fortune'
 *
 * const app = new Fortune()
 * const server = http.createServer(Fortune.net.http.bind(app))
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
    .then(end, end)
    .catch(error => {
      response.statusCode = statusMap.get(Error)
      response.setHeader('Content-Type', 'text/plain')
      response.end(error.toString())
      return error
    })

  // Internal function to end the response.
  function end (contextResponse) {
    const { payload, meta } = contextResponse

    response.statusCode = statusMap.get(contextResponse.constructor) ||
      statusMap.get(Error)

    for (let field in meta)
      response.setHeader(field, meta[field])

    return new Promise((resolve, reject) => !payload ||
      Buffer.isBuffer(payload) || typeof payload === 'string' ?
      response.end(payload, resolve) :
      reject(new Error(`The response is malformed.`)))
  }
}
