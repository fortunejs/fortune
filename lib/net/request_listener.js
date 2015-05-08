import crypto from 'crypto'
import Negotiator from 'negotiator'
import statusMap from './status_map'
import * as errors from '../common/errors'


const headerDelimiter = ', '

const defaults = {

  // ETag settings.
  useETag: true,
  hashAlgorithm: 'md5',
  digestEncoding: 'base64',

  // Cross-origin resource sharing.
  useCORS: true,
  allowMethods: [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ],
  allowHeaders: [],
  allowCredentials: true,
  allowOrigin: '*',
  exposeHeaders: [],
  maxAge: 0

}


/**
 * A basic HTTP request event listener. This function must be bound to a
 * Fortune instance. The only integration it has with Fortune is in doing
 * content negotiation for the serializers, and parsing the response from the
 * dispatcher.
 *
 * Usage: `fortune.net.requestListener.bind(app, settings)`
 *
 * Where `app` is a Fortune instance, and `settings` is an object. The optional
 * `settings` argument to `bind` overrides the `defaults` object.
 */
export default function requestListener () {
  // Only care about object arguments, for interoperation
  // with middleware implementations.
  const args = Array.prototype.filter
    .call(arguments, arg => typeof arg === 'object')

  let settings, request, response

  // With settings binding.
  if (args.length === 3) {
    settings = Object.assign({}, defaults, args[0])
    request = args[1]
    response = args[2]
  }

  // Without settings binding.
  else if (args.length === 2) {
    settings = defaults
    request = args[0]
    response = args[1]
  }

  else throw new Error('Arity of requestListener function is invalid.')

  const { headers, method } = request

  // Intercept CORS preflight request.
  if (settings.useCORS && method === 'OPTIONS' &&
    'origin' in headers &&
    'access-control-request-method' in headers) {
      response.writeHead(statusMap.get('success'),
        getCorsPreflightHeaders(settings))
      return response.end()
  }

  const serializerOutput = new Negotiator(request)
    .mediaType(this.serializer.ids)

  if (!serializerOutput) {
    response.writeHead(statusMap.get(errors.NotAcceptableError))
    return response.end()
  }

  // Get the media type of the request.
  // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
  const serializerInput = (request.headers['content-type'] || '')
    .match(/[^;]*/)[0]

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  const options = { serializerInput, serializerOutput }

  const chunks = []

  request.on('data', chunk => chunks.push(chunk))

  request.on('end', () => {
    // Augment the request object with the content of the entire body.
    options.payload = Buffer.concat(chunks)

    // Pass the options and system request/response objects.
    this.dispatch(options, request, response).then(
      contextResponse => sendResponse.call(contextResponse, {
        defaultStatus: statusMap.get('success')
      }, request, response),
      contextResponse => sendResponse.call(contextResponse, {
        defaultStatus: statusMap.get('error')
      }, request, response))
  })

  // Internal function to send the response.
  function sendResponse (options, request, response) {
    const { payload } = this
    const { headers, method } = request
    const meta = {}
    let status

    for (let field in this.meta) {
      if (field !== 'status') meta[field] = this.meta[field]
      else status = this.meta[field]
    }

    if (Buffer.isBuffer(payload) || typeof payload === 'string') {
      // ETag handling.
      if (settings.useETag) {
        const ETag = `"${crypto.createHash(settings.hashAlgorithm)
          .update(payload).digest(settings.digestEncoding)}"`

        if (headers['if-none-match'] === ETag) {
          response.writeHead(statusMap.get('notModified'), { ETag })
          return response.end()
        }

        Object.assign(meta, { ETag })
      }

      Object.assign(meta, {
        'Content-Length': payload.length
      })

      // Special case for POST request.
      if (method === 'POST' && !status)
        status = statusMap.get('created')

    } else if (!status)
      status = statusMap.get('empty')

    if (settings.useCORS && 'origin' in headers)
      Object.assign(meta, getCorsResponseHeaders(settings))

    status = (this instanceof Error ?
      statusMap.get(this.constructor) : status) || options.defaultStatus

    response.writeHead(status, meta)

    return response.end(payload)
  }

  // Used for responding to CORS preflight request.
  function getCorsPreflightHeaders (settings) {
    return Object.assign({
        'Access-Control-Allow-Origin': settings.allowOrigin
      }, settings.allowMethods.length ? {
        'Access-Control-Allow-Methods':
          settings.allowMethods.join(headerDelimiter)
      } : null, settings.allowCredentials ? {
        'Access-Control-Allow-Credentials': 'true'
      } : null, settings.maxAge ? {
        'Access-Control-Max-Age': settings.maxAge
      } : null, settings.allowHeaders.length ? {
        'Access-Control-Allow-Headers':
          settings.allowHeaders.join(headerDelimiter)
      } : null)
  }

  // Used for responding to CORS request.
  function getCorsResponseHeaders (settings) {
    return Object.assign({
        'Access-Control-Allow-Origin': settings.allowOrigin
      }, settings.exposeHeaders.length ? {
        'Access-Control-Expose-Headers': settings.exposeHeaders
      } : null, settings.allowCredentials ? {
        'Access-Control-Allow-Credentials': 'true'
      } : null)
  }

}
