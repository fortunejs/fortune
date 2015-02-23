import uriTemplates from 'uri-templates';
import inflection from 'inflection';
import Serializer from '../../';

const queryDelimiter = '?';
const defaults = {
  inflect: true,
  extensions: ['patch', 'bulk'],
  uriTemplate: '{/type,ids,relatedField}{?query*}'
};

export default class jsonApiSerializer extends Serializer {

  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1)
      return context;

    // Parse the URI template.
    if (!('_uriTemplate' in this))
      this._uriTemplate =
        uriTemplates(this.options.uriTemplate || defaults.uriTemplate);

    let request = context.request;
    let systemRequest = arguments[1];
    let inflect = 'inflect' in this.options ?
      this.options.inflect : defaults.inflect;

    // WORKAROUND: This is a hack to make the query string optional.
    let uriObject = this._uriTemplate.fromUri(
      !~systemRequest.url.indexOf(queryDelimiter) ?
      systemRequest.url + queryDelimiter : systemRequest.url);
    delete uriObject.query[''];

    // Inflect type name.
    if (!!inflect)
      uriObject.type = inflection.singularize(uriObject.type);

    request.action = determineAction(context, systemRequest);
    request.type = uriObject.type;
    request.ids = uriObject.ids || [];
    request.relatedField = uriObject.relatedField || '';
    request.payload = systemRequest.body.length ?
      JSON.parse(systemRequest.body.toString()) : '';

    return context;
  }

  processResponse (context) {
    let payload = context.response.payload;

    if (typeof payload === 'object')
      context.response.payload = JSON.stringify(payload, null, 2);

    return context;
  }

  showResource (context, entities) {
    let obj = {};
    obj.data = entities;
    context.response.payload = obj;
    return context;
  }

  parseCreate (context) {
    return context.request.payload.data;
  }

}

function determineAction (context, systemRequest) {
  let handlers = {
    GET: 'find',
    POST: 'create',
    DELETE: 'delete'
  };
  let handler = handlers[systemRequest.method];
  return typeof handler === 'function' ? handler() : handler;
}
