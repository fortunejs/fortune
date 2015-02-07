import accepts from 'accepts';
import typer from 'media-typer';

/*!
 * A default HTTP request event listener. Remember to bind it to
 * a Fortune instance.
 */
export default function (systemRequest, systemResponse) {
  this.options._serializerIds = this.options._serializerIds ||
    this.options.serializers.map(serializer => serializer.id);

  let handler = (response) => {
    systemResponse.writeHead(response.statusCode || 200, response.meta);
    systemResponse.end(response.payload);
  };

  let accept = accepts(systemRequest);
  let inputType = systemRequest.headers['content-type'] || '';

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
    systemRequest.body = Buffer.concat(chunks);
    this.request(options, ...arguments).then(handler, handler);
  });
}
