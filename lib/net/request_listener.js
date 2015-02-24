import crypto from 'crypto';
import accepts from 'accepts';
import contentType from 'content-type';
import etag from 'etag';

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

  let accept = accepts(systemRequest);
  let inputType;

  try {
    inputType = contentType.parse(systemRequest).type;
  } catch (error) {
    inputType = '';
  }

  // Note that this delegates all handling of options parameters
  // to the individual serializer.
  let options = {
    meta: systemRequest.headers,
    serializerOutput: accept.type(this.options._serializerIds),
    serializerInput: inputType
  };

  let chunks = [];
  systemRequest.on('data', chunk => chunks.push(chunk));

  systemRequest.on('end', () => {
    // Augment the request object with the content of the entire body.
    systemRequest.body = Buffer.concat(chunks);

    // Pass the options and system request/response objects.
    this.request(options, ...arguments).then(
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
  let hash = etag(response.payload);

  if (systemRequest.headers['if-none-match'] === hash) {
    systemResponse.writeHead(304);
    return systemResponse.end();
  }

  Object.assign(response.meta, {
    'content-length': response.payload.length,
    'etag': hash
  });

  systemResponse.writeHead(
    response.statusCode || defaultStatus, response.meta);
  return systemResponse.end(response.payload);
}
