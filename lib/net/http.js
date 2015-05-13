import Negotiator from 'negotiator'
import statusMap from './status_map'
import * as errors from '../common/errors'


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
  return new Promise(resolve => {
    const serializerOutput = new Negotiator(request)
      .mediaType(this.serializer.ids)

    if (!serializerOutput) {
      response.statusCode = statusMap.get(errors.NotAcceptableError)
      return response.end(resolve)
    }

    // Get the media type of the request.
    // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
    const serializerInput = (request.headers['content-type'] || '')
      .match(/[^;]*/)[0] || undefined

    // Note that this delegates all handling of options parameters
    // to the individual serializer.
    const options = { serializerInput, serializerOutput }

    // Pass the options and system request/response objects to Fortune.
    return this.dispatch(options, request, response)
    .then(end, end).then(resolve)
  })

  // Internal function to end the response.
  function end (contextResponse) {
    const { payload, meta } = contextResponse
    const headers = {}

    if (Buffer.isBuffer(payload) || typeof payload === 'string')
      headers['Content-Length'] = payload.length

    response.statusCode = statusMap.get(contextResponse.constructor) ||
      statusMap.get(Error)

    for (let field in meta)
      response.setHeader(field, meta[field])

    return new Promise(resolve =>
      response.end(payload, resolve))
  }
}


// Might be useful as a named export.
export { statusMap }
