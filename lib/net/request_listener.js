import crypto from 'crypto';
import Negotiator from 'negotiator';

const hashAlgorithm = 'md5';
const digestEncoding = 'hex';
const defaultSuccess = 200;
const defaultError = 500;


/*!
 * A default HTTP request event listener. Remember to bind it to
 * a Fortune instance.
 */
export default function (systemRequest, systemResponse) {
  // Slightly hacky, memoize the serializer IDs in an array.
  if (!('_serializerIds' in this.options))
    this.options._serializerIds =
      this.options.serializers.map(serializer => serializer.id);

  let outputType = new Negotiator(systemRequest)
    .mediaType(this.options._serializerIds);

  if (!outputType) {
    systemResponse.writeHead(406);
    return systemResponse.end();
  }

  // Get the media type of the request.
  let inputType = (systemRequest.headers['content-type'] || '').split(';')[0];

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  let options = {
    meta: systemRequest.headers,
    serializerOutput: outputType,
    serializerInput: inputType
  };

  let chunks = [];
  systemRequest.on('data', chunk => chunks.push(chunk));

  systemRequest.on('end', () => {
    // Augment the request object with the content of the entire body.
    systemRequest.body = Buffer.concat(chunks);

    // Pass the options and system request/response objects.
    this.dispatcher.request(options, ...arguments).then(
      response => endResponse(
        response, systemRequest, systemResponse, defaultSuccess),
      response => endResponse(
        response, systemRequest, systemResponse, defaultError));
  });
}


/*!
 * Internal function to end the response.
 */
function endResponse (response, systemRequest, systemResponse, defaultStatus) {
  if (response.payload.length) {
    let hash = crypto.createHash(hashAlgorithm)
      .update(response.payload).digest(digestEncoding);

    if (systemRequest.headers['if-none-match'] === hash) {
      systemResponse.writeHead(304);
      return systemResponse.end();
    }

    Object.assign(response.meta, {
      'content-length': response.payload.length,
      'etag': hash
    });
  }

  systemResponse.writeHead(
    response.statusCode || defaultStatus, response.meta);

  return systemResponse.end(response.payload);
}
