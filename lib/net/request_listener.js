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
  CORS: {
    allowMethods: [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ],
    allowHeaders: [],
    allowCredentials: false,
    allowOrigin: '*',
    exposeHeaders: [],
    maxAge: 0
  }

}


/**
 * A basic HTTP request event listener. This function must be bound to a
 * Fortune instance. The only integration it has with Fortune is in doing
 * content negotiation for the serializers, and parsing the response from the
 * dispatcher.
 *
 * Usage: `fortune.net.requestListener.bind(app, options)`
 *
 * The optional `options` argument to `bind` reflects the `defaults` object.
 */
export default function requestListener () {
  let settings, request, response

  // With settings binding.
  if (arguments.length === 3) {
    settings = Object.assign({}, defaults, arguments[0])
    request = arguments[1]
    response = arguments[2]
  }
  // Without settings binding.
  else if (arguments.length === 2) {
    settings = Object.assign({}, defaults)
    request = arguments[0]
    response = arguments[1]
  }
  else throw new Error('Arity of requestListener function is invalid.')

  const { headers, method } = request

  // Intercept CORS preflight request.
  if (method === 'OPTIONS' &&
    'origin' in headers &&
    'access-control-request-method' in headers) {
      response.writeHead(statusMap.get('success'), getCorsPreflightHeaders())
      return response.end()
  }

  const serializerOutput = new Negotiator(request).mediaType()

  if (!serializerOutput) {
    response.writeHead(statusMap.get(errors.NotAcceptableError))
    return response.end()
  }

  // Get the media type of the request.
  // See RFC 2045: https://www.ietf.org/rfc/rfc2045.txt
  const serializerInput = (request.headers['content-type'] || '').split(';')[0]

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  const options = { serializerInput, serializerOutput }

  const chunks = []

  request.on('data', chunk => chunks.push(chunk))

  request.on('end', () => {
    // Augment the request object with the content of the entire body.
    options.payload = Buffer.concat(chunks).toString()

    // Pass the options and system request/response objects.
    this.dispatcher.request(options, request, response).then(
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

    if (payload) {
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
      if (method === 'POST')
        status = statusMap.get('created')

    } else if (!status)
      status = statusMap.get('empty')

    if ('origin' in headers)
      Object.assign(meta, getCorsResponseHeaders())

    status = (this instanceof Error ?
      statusMap.get(this.constructor) : status) || options.defaultStatus

    response.writeHead(status, meta)

    return response.end(payload)
  }

  // Used for responding to CORS preflight request.
  function getCorsPreflightHeaders () {
    return Object.assign({
        'Access-Control-Allow-Origin': settings.CORS.allowOrigin
      }, settings.CORS.allowMethods.length ? {
        'Access-Control-Allow-Methods':
          settings.CORS.allowMethods.join(headerDelimiter)
      } : null, settings.CORS.allowCredentials ? {
        'Access-Control-Allow-Credentials': 'true'
      } : null, settings.CORS.maxAge ? {
        'Access-Control-Max-Age': settings.CORS.maxAge
      } : null, settings.CORS.allowHeaders.length ? {
        'Access-Control-Allow-Headers':
          settings.CORS.allowHeaders.join(headerDelimiter)
      } : null)
  }

  // Used for responding to CORS request.
  function getCorsResponseHeaders () {
    return Object.assign({
        'Access-Control-Allow-Origin': settings.CORS.allowOrigin
      }, settings.CORS.exposeHeaders.length ? {
        'Access-Control-Expose-Headers': settings.CORS.exposeHeaders
      } : null, settings.CORS.allowCredentials ? {
        'Access-Control-Allow-Credentials': 'true'
      } : null)
  }

}
