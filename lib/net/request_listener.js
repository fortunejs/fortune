import accepts from 'accepts';

/*!
 * The default HTTP request event listener. Remember to bind it to
 * a Fortune instance.
 */
export default function (systemRequest, systemResponse) {
  this.options._serializerIds = this.options._serializerIds ||
    this.options.serializers.map(serializer => serializer.id);

  let handler = (response) => {
    systemResponse.writeHead(response.statusCode, response.meta);
    systemResponse.end(response.payload);
  };

  let accept = accepts(systemRequest);

  // Content type is so damn simple to parse that it doesn't need a
  // module to do it.
  let contentType = (systemRequest.headers['content-type'] || '')
    .split(';')[0];

  let options = {
    meta: systemRequest.headers,
    serializerOutput: accept.type(this.options._serializerIds),
    serializerInput: contentType
  };

  this.request(options, ...arguments).then(handler, handler);
}
