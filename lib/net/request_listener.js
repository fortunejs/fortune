import crypto from 'crypto';
import Negotiator from 'negotiator';
import statusMap from './status_map';
import * as errors from '../common/errors';

const headerDelimiter = ', ';
const spaces = 0;
const hashAlgorithm = 'md5';
const digestEncoding = 'base64';
const CORS = {
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: [],
  allowCredentials: false,
  allowOrigin: '*',
  exposeHeaders: [],
  maxAge: 0
};


/*!
 * A default HTTP request event listener. This function must be bound to
 * a Fortune instance.
 */
export default function requestListener (request, response) {
  if (request.method === 'OPTIONS' &&
    'origin' in request.headers &&
    'access-control-request-method' in request.headers)
    response.writeHead(statusMap.get('success'), getCorsPreflightHeaders());

  let isHead = false;

  // HEAD is a special case, pretend it's a GET request until the very end
  // when the payload needs to be written.
  if (request.method === 'HEAD') {
    request.method = 'GET';
    isHead = true;
  }

  let serializerOutput = new Negotiator(request).mediaType();

  if (!serializerOutput) {
    response.writeHead(statusMap.get(errors.NotAcceptableError));
    return response.end();
  }

  // Get the media type of the request.
  let serializerInput = (request.headers['content-type'] || '').split(';')[0];

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  let options = { serializerInput, serializerOutput };

  let chunks = [];

  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    // Augment the request object with the content of the entire body.
    options.payload = Buffer.concat(chunks).toString();

    // Pass the options and system request/response objects.
    this.dispatcher.request(options, ...arguments).then(
      contextResponse => sendResponse.call(contextResponse, {
        isHead, defaultStatus: statusMap.get('success')
      }, ...arguments),
      contextResponse => sendResponse.call(contextResponse, {
        isHead, defaultStatus: statusMap.get('error')
      }, ...arguments));
  });
}


// Assign static properties.
Object.assign(requestListener, {
  spaces, hashAlgorithm, digestEncoding, CORS
});


/*!
 * Internal function to send the response.
 */
function sendResponse (options, request, response) {
  let payload = this.payload;

  if (typeof payload === 'object')
    if (Object.keys(payload).length)
      payload = JSON.stringify(payload, null, requestListener.spaces);
    else payload = null;

  // ETag handling.
  if (payload) {
    let etag = `"${crypto.createHash(requestListener.hashAlgorithm)
      .update(payload).digest(requestListener.digestEncoding)}"`;

    if (request.headers['if-none-match'] === etag) {
      response.writeHead(statusMap.get('notModified'), { etag });
      return response.end();
    }

    Object.assign(this.meta, {
      'content-length': payload.length,
      etag
    });

    // Special case for POST request.
    if (request.method === 'POST')
      this.statusCode = statusMap.get('created');

  } else if (!this.statusCode)
    this.statusCode = statusMap.get('empty');

  if ('origin' in request.headers)
    Object.assign(this.meta, getCorsResponseHeaders());

  if (this instanceof Error)
    this.statusCode = statusMap.get(this.constructor);

  response.writeHead(this.statusCode || options.defaultStatus, this.meta);

  return response.end(!options.isHead ? payload : null);
}


function getCorsPreflightHeaders () {
  return Object.assign({
      'access-control-allow-origin': requestListener.CORS.allowOrigin
    }, requestListener.CORS.allowMethods.length ? {
      'access-control-allow-methods':
        requestListener.CORS.allowMethods.join(headerDelimiter)
    } : null, requestListener.CORS.allowCredentials ? {
      'access-control-allow-credentials': 'true'
    } : null, requestListener.CORS.maxAge ? {
      'access-control-max-age': requestListener.CORS.maxAge
    } : null, requestListener.CORS.allowHeaders.length ? {
      'access-control-allow-headers':
        requestListener.CORS.allowHeaders.join(headerDelimiter)
    } : null);
}


function getCorsResponseHeaders () {
  return Object.assign({
      'access-control-allow-origin': requestListener.CORS.allowOrigin
    }, requestListener.CORS.exposeHeaders.length ? {
      'access-control-expose-headers': requestListener.CORS.exposeHeaders
    } : null, requestListener.CORS.allowCredentials ? {
      'access-control-allow-credentials': 'true'
    } : null);
}
