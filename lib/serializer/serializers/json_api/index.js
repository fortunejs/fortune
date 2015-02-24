import uriTemplates from 'uri-templates';
import inflection from 'inflection';
import Serializer from '../../';
import keys from '../../../schema/reserved_keys';
import * as Errors from '../../../common/errors';

const queryDelimiter = '?';
const defaults = {
  inflect: {
    type: true,
    keys: true
  },
  extensions: ['patch', 'bulk'],
  prefix: 'http://example.com',
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'
};
const statusMap = new Map();

statusMap.set('created', 201);
statusMap.set('empty', 204);
statusMap.set(Errors.BadRequestError, 400);
statusMap.set(Errors.UnauthorizedError, 401);
statusMap.set(Errors.ForbiddenError, 403);
statusMap.set(Errors.NotFoundError, 404);
statusMap.set(Errors.MethodError, 405);
statusMap.set(Errors.NotAcceptableError, 406);
statusMap.set(Errors.ConflictError, 409);
statusMap.set(Errors.UnsupportedError, 415);


/**
 * JSON API serializer.
 */
export default class jsonApiSerializer extends Serializer {

  processRequest (context) {
    // Set options.
    if (!('_options' in this))
      this._options = Object.assign(defaults, this.options);

    // Parse the URI template.
    if (!('_uriTemplate' in this))
      this._uriTemplate = uriTemplates(this._options.uriTemplate);

    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1)
      return context;

    let request = context.request;
    let systemRequest = arguments[1];

    // WORKAROUND: This is a hack to make the query string optional.
    let uriObject = this._uriTemplate.fromUri(
      !~systemRequest.url.indexOf(queryDelimiter) ?
      systemRequest.url + queryDelimiter : systemRequest.url);
    delete uriObject.query[''];

    // Inflect type name.
    if (!!this._options.inflect.type)
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

    context.response.meta['content-type'] =
      context.request.serializerOutput + (this._options.extensions.length ?
        `; ext=${this._options.extensions.join(',')}` : '');

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
    context.response.statusCode = statusMap.get('created');
    return context.request.payload.data;
  }


  showError (context, error) {
    let errors = [];

    errors.push({
      title: error.name,
      detail: error.message
    });

    context.response.statusCode = statusMap.get(error.constructor);
    context.response.payload = {
      errors: errors
    };

    return context;
  }

}

/*!
 * Internal function to map an entity to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapEntity (type, entity) {
  let options = this.options;
  let prefix = 'prefix' in options ?
      options.prefix : defaults.prefix;
  let primaryKey = type in options.generic.primaryKeyPerType ?
    options.generic.primaryKeyPerType[type] : options.generic.primaryKey;
  let id = entity[primaryKey];

  delete entity[primaryKey];

  entity.links = {
    self: prefix + this._uriTemplate.fillFromObject({
      type: this._options.inflect.type ? inflection.pluralize(type) : type,
      ids: id
    })
  };

  for (let field in entity) {
    let schemaField = this.schemas[type][field];

    // Per the recommendation, dasherize keys.
    if (!!this._options.inflect.keys) {
      let value = entity[field];
      delete entity[field];
      entity[inflection.transform(field,
        ['underscore', 'dasherize'])] = value;
    }

    // If it's not a link we can continue.
    if (!schemaField || !schemaField[keys.link])
      continue;

    let ids = entity[field];
    delete entity[field];

    if (!schemaField[keys.isArray] && Array.isArray(ids))
      ids = ids[0];

    if (schemaField[keys.isArray] && !Array.isArray(ids))
      ids = [ids];

    entity.links[field] = Object.assign({
      resource: prefix + this._uriTemplate.fillFromObject({
        type: this._options.inflect.type ? inflection.pluralize(type) : type,
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
  // TODO: PUT, PATCH, HEAD, OPTIONS
  let handlers = {
    get: 'find',
    post: 'create',
    delete: 'delete'
  };
  let handler = handlers[systemRequest.method.toLowerCase()];
  return typeof handler === 'function' ? handler() : handler;
}
