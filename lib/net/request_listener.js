import crypto from 'crypto';
import Negotiator from 'negotiator';

const hashAlgorithm = 'md5';
const digestEncoding = 'base64';
const defaultSuccess = 200;
const defaultError = 500;


/*!
 * A default HTTP request event listener. Remember to bind it to
 * a Fortune instance.
 */
export default function (request, response) {
  let outputType = new Negotiator(request).mediaType();

  if (!outputType) {
    response.writeHead(406);
    return response.end();
  }

  // Get the media type of the request.
  let inputType = (request.headers['content-type'] || '').split(';')[0];

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  let options = {
    meta: request.headers,
    serializerOutput: outputType,
    serializerInput: inputType
  };

  let chunks = [];
  request.on('data', chunk => chunks.push(chunk));

  request.on('end', () => {
    // Augment the request object with the content of the entire body.
    request.body = Buffer.concat(chunks);

    // Pass the options and system request/response objects.
    this.dispatcher.request(options, ...arguments).then(
      contextResponse => endResponse(
        contextResponse, request, response, defaultSuccess),
      contextResponse => endResponse(
        contextResponse, request, response, defaultError));
  });
}


/*!
 * Internal function to end the response.
 */
function endResponse (contextResponse, request, response, defaultStatus) {
  if (contextResponse.payload.length) {
    let etag = `"${crypto.createHash(hashAlgorithm)
      .update(contextResponse.payload).digest(digestEncoding)}"`;

    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, { etag });
      return response.end();
    }

    Object.assign(contextResponse.meta, {
      'content-length': contextResponse.payload.length,
      etag
    });
  }

  response.writeHead(contextResponse.statusCode || defaultStatus,
    contextResponse.meta);

  return response.end(contextResponse.payload);
}
