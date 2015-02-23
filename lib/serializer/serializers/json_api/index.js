import uriTemplates from 'uri-templates';
import inflection from 'inflection';
import Serializer from '../../';
import keys from '../../../schema/reserved_keys';

const queryDelimiter = '?';
const defaults = {
  inflect: true,
  extensions: ['patch', 'bulk'],
  prefix: 'http://fuckoff.com',
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'
};

export default class jsonApiSerializer extends Serializer {

  processRequest (context) {
    // Parse the URI template.
    if (!('_uriTemplate' in this))
      this._uriTemplate =
        uriTemplates(this.options.uriTemplate || defaults.uriTemplate);

    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1)
      return context;

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
    let type = context.request.type;
    let output = {};

    output.data = entities.map(entity =>
      mapEntity.call(this, type, entity));

    if (output.data.length === 1)
      output.data = output.data[0];

    context.response.payload = output;

    return context;
  }

  parseCreate (context) {
    return context.request.payload.data;
  }

}

/*!
 * Internal function to map an entity to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapEntity (type, entity) {
  let options = this.options;
  let inflect = 'inflect' in options ?
      options.inflect : defaults.inflect;
  let prefix = 'prefix' in options ?
      options.prefix : defaults.prefix;
  let primaryKey = type in options.generic.primaryKeyPerType ?
    options.generic.primaryKeyPerType[type] : options.generic.primaryKey;
  let id = entity[primaryKey];

  delete entity[primaryKey];

  entity.links = {
    self: prefix + this._uriTemplate.fillFromObject({
      type: inflect ? inflection.pluralize(type) : type,
      ids: id
    })
  };

  for (let field in entity) {
    let schemaField = this.schemas[type][field];

    if (!schemaField || !schemaField[keys.link]) continue;

    let ids = entity[field];

    if (!schemaField[keys.isArray] && Array.isArray(ids))
      ids = ids[0];

    if (schemaField[keys.isArray] && !Array.isArray(ids))
      ids = [ids];

    entity.links[field] = Object.assign({
      resource: prefix + this._uriTemplate.fillFromObject({
        type: inflect ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: field
      }),
      type: schemaField[keys.link]
    }, schemaField[keys.isArray] ?
      {ids: ids.map(id => id.toString())} : {id: ids.toString()});
  }

  entity.type = type;
  entity.id = id.toString();

  return entity;
}


/*!
 * Internal function to determine the action, there are edge cases in which
 * PUT and PATCH can create entities.
 */
function determineAction (context, systemRequest) {
  let handlers = {
    GET: 'find',
    POST: 'create',
    DELETE: 'delete'
  };
  let handler = handlers[systemRequest.method];
  return typeof handler === 'function' ? handler() : handler;
}
