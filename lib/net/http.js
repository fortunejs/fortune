import Negotiator from 'negotiator'
import statusMap from './status_map'
import * as errors from '../common/errors'


/**
 * This function mutates Node's `request` and `response` objects, and returns a
 * `Promise` that resolves to the payload to be written. Note that the response
 * object is mutated with implicit headers. The only integration it has with
 * Fortune is in doing content negotiation to determine which serializer to use,
 * and mapping the response from the `dispatch` method on to the response
 * object.
 *
 * @param {Fortune} app - An instance of Fortune.
 * @param {Object} request - Node's `request` object.
 * @param {Object} response - Node's `response` object.
 * @return {Promise}
 */
export default function http (app, request, response) {
  return new Promise(resolve => {
    const serializerOutput = new Negotiator(request)
      .mediaType(app.serializer.ids)

    if (!serializerOutput) {
      response.writeHead(statusMap.get(errors.NotAcceptableError))
      return resolve()
    }

    // Get the media type of the request.
    // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
    const serializerInput = (request.headers['content-type'] || '')
      .match(/[^;]*/)[0] || undefined

    // Note that this delegates all handling of options parameters
    // to the individual serializer.
    const options = { serializerInput, serializerOutput }

    const chunks = []

    request.on('data', chunk => chunks.push(chunk))

    request.on('end', () => {
      // Augment the request object with the content of the entire body.
      options.payload = Buffer.concat(chunks)

      // Pass the options and system request/response objects to Fortune.
      app.dispatch(options, request, response)
      .then(end.bind({
        request, response,
        defaultStatus: statusMap.get('success')
      }))
      .catch(end.bind({
        request, response,
        defaultStatus: statusMap.get('error')
      }))
      .then(resolve)
    })
  })
}


// Internal function to end the response.
function end (contextResponse) {
  const { defaultStatus, request, response } = this
  const { payload, meta } = contextResponse
  const { method } = request
  const headers = {}
  let status

  for (let field in meta) {
    if (field !== 'status') headers[field] = meta[field]
    else status = meta[field]
  }

  if (Buffer.isBuffer(payload) || typeof payload === 'string') {
    headers['Content-Length'] = payload.length

    // Special case for POST method.
    if (method === 'POST' && !status)
      status = statusMap.get('created')

  } else if (!status)
    status = statusMap.get('empty')

  status = (contextResponse instanceof Error ?
    statusMap.get(contextResponse.constructor) : status) ||
    defaultStatus

  response.statusCode = status

  for (let header in headers)
    response.setHeader(header, headers[header])

  return payload
}
