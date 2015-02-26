import crypto from 'crypto';
import Negotiator from 'negotiator';
import * as Errors from '../common/errors';
import statusMap from './status_map';

const hashAlgorithm = 'md5';
const digestEncoding = 'base64';


/*!
 * A default HTTP request event listener. Remember to bind it to
 * a Fortune instance.
 */
export default function (request, response) {
  let serializerOutput = new Negotiator(request).mediaType();

  if (!serializerOutput) {
    response.writeHead(statusMap.get(Errors.NotAcceptableError));
    return response.end();
  }

  // Get the media type of the request.
  let serializerInput = (request.headers['content-type'] || '').split(';')[0];

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  let options = {
    meta: request.headers,
    serializerOutput,
    serializerInput
  };

  let chunks = [];

  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    // Augment the request object with the content of the entire body.
    request.body = Buffer.concat(chunks);

    // Pass the options and system request/response objects.
    this.dispatcher.request(options, ...arguments).then(
      contextResponse => endResponse.call(contextResponse, {
        defaultStatus: statusMap.get('success')
      }, ...arguments),
      contextResponse => endResponse.call(contextResponse, {
        defaultStatus: statusMap.get('error')
      }, ...arguments));
  });
}


/*!
 * Internal function to end the response.
 */
function endResponse (options, request, response) {
  if (this.payload.length) {
    let etag = `"${crypto.createHash(hashAlgorithm)
      .update(this.payload).digest(digestEncoding)}"`;


    if (request.headers['if-none-match'] === etag) {
      response.writeHead(statusMap.get('notModified'), { etag });
      return response.end();
    }

    Object.assign(this.meta, {
      'content-length': this.payload.length,
      etag
    });

  // Special case for POST request.
  if (request.method === 'POST')
    this.statusCode = statusMap.get('created');

  } else {
    if (!this.statusCode)
      this.statusCode = statusMap.get('empty');
  }

  if (this instanceof Error)
    this.statusCode = statusMap.get(this.constructor);

  response.writeHead(this.statusCode || options.defaultStatus,
    this.meta);

  return response.end(this.payload);
}
