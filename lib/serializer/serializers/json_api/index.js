import uriTemplates from 'uri-templates';
import inflection from 'inflection';


const queryDelimiter = '?';

const specKeys = {
  links: 'links',
  self: 'self',
  type: 'type',
  id: 'id'
};

const defaults = {
  inflect: {
    type: true,
    keys: true
  },
  spaces: 0,
  bufferEncoding: 'base64',
  extensions: ['patch', 'bulk'],
  prefix: 'http://example.com',
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'
};

// TODO: PUT, PATCH
const handlers = {
  GET: 'find',
  POST: 'create',
  DELETE: 'delete'
};


/**
 * JSON API serializer.
 */
export default Serializer => class jsonApiSerializer extends Serializer {

  constructor () {
    super(...arguments);

    Object.defineProperties(this, {

      // Set options.
      _options: {
        value: Object.assign(defaults, this.options)
      },

      // Parse the URI template.
      _uriTemplate: {
        value: uriTemplates(
          this.options.uriTemplate || defaults.uriTemplate)
      }

    });
  }


  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1)
      return context;

    let request = arguments[1];

    // WORKAROUND: This is a hack to make the query string optional.
    let uriObject = this._uriTemplate.fromUri(
      ~request.url.indexOf(queryDelimiter) ? request.url :
      request.url + queryDelimiter);
    delete uriObject.query[''];

    // Inflect type name.
    if (this._options.inflect.type)
      uriObject.type = inflection.singularize(uriObject.type);

    context.request.action = determineAction(context, request);

    let type = context.request.type = uriObject.type;
    let ids = context.request.ids = uriObject.ids || [];
    let payload = context.request.payload;

    if (payload && typeof payload !== 'object') {
      try {
        context.request.payload = JSON.parse(payload);
      } catch (error) {
        throw new this.errors.BadRequestError(
          `Error parsing JSON request.`);
      }
    }

    let relatedField = uriObject.relatedField;

    if (relatedField && !this.schemas[type].hasOwnProperty(relatedField))
      throw new this.errors.NotFoundError(`The field "${relatedField}" is ` +
        `non-existent on the type "${type}".`);

    return relatedField ? this.adapter.find(type, ids, {
      fields: { [relatedField]: true }
    }).then(records => {
      // If there's no related IDs, and we're not trying to create something,
      // then something is missing.
      if (!relatedIds.length && context.request.action !== 'create')
        throw new this.errors.NotFoundError(
          `No related records match the request.`);

      let relatedType = this.schemas[type][relatedField][this.keys.link];

      // Reduce the related IDs from all of the records into an array of
      // unique IDs.
      let relatedIds = [...(records || []).reduce((ids, record) => {
        let related = record[relatedField];

        (Array.isArray(related) ? related : [related])
          .forEach(id => ids.add(id));

        return ids;
      }, new Set())];

      // Copy the original type and IDs to temporary keys.
      context.request._relatedField = relatedField;
      context.request._originalType = type;
      context.request._originalIds = ids;

      // Write the related info to the request, which should take precedence
      // over the original type and IDs.
      context.request.type = relatedType;
      context.request.ids = relatedIds;

      return context;
    }) : context;
  }


  processResponse (context) {
    let payload = context.response.payload;
    let options = this._options;

    if (typeof payload === 'object')
      if (Object.keys(payload).length)
        context.response.payload =
          JSON.stringify(payload, function (key, value) {
            return Buffer.isBuffer(value) ?
              value.toString(options.bufferEncoding) : value;
          }, options.spaces);
      else
        context.response.payload = undefined;

    context.response.meta['content-type'] =
      context.request.serializerOutput + (this._options.extensions.length ?
        `; ext=${this._options.extensions.join(',')}` : '');

    return context;
  }


  showResponse (context, records) {
    let type = context.request.type;
    let output = {};

    if (records && records.length) {
      output.data = records.map(record =>
        mapRecord.call(this, type, record));

      if (output.data.length === 1)
        output.data = output.data[0];
    }

    context.response.payload = output;

    return context;
  }


  // TODO; Bulk create, stupid JSON API format
  parseCreate (context) {
    let payload = context.request.payload;

    return [payload.data];
  }


  showError (context, error) {
    let errors = [];

    errors.push(Object.assign({
      title: error.name,
      detail: error.message
    }, error));

    context.response.payload = {
      errors: errors
    };

    return context;
  }

}

/*!
 * Internal function to map an record to JSON API format. It must be
 * called directly within the context of the serializer. Within this
 * function, IDs must be cast to strings, per the spec.
 */
function mapRecord (type, record) {
  let keys = this.keys;
  let options = this.options;
  let primaryKey = this.primaryKey;
  let prefix = options.hasOwnProperty('prefix') ?
      options.prefix : defaults.prefix;
  let toString = id => id.toString();
  let id = record[primaryKey];

  delete record[primaryKey];

  record[specKeys.id] = id.toString();
  record[specKeys.type] = type;

  record[specKeys.links] = {
    [specKeys.self]: prefix + this._uriTemplate.fillFromObject({
      type: this._options.inflect.type ? inflection.pluralize(type) : type,
      ids: id
    })
  };

  for (let field in record) {
    let schemaField = this.schemas[type][field];

    // Per the recommendation, dasherize keys.
    if (this._options.inflect.keys && !specKeys.hasOwnProperty(field)) {
      let value = record[field];
      delete record[field];
      record[inflection.transform(field,
        ['underscore', 'dasherize'])] = value;
    }

    // If it's not a link we can continue.
    if (!schemaField || !schemaField[keys.link])
      continue;

    let ids = record[field];
    delete record[field];

    if (!schemaField[keys.isArray] && Array.isArray(ids))
      ids = ids[0];

    if (schemaField[keys.isArray] && !Array.isArray(ids))
      ids = [ids];

    record[specKeys.links][field] = Object.assign({
      resource: prefix + this._uriTemplate.fillFromObject({
        type: this._options.inflect.type ? inflection.pluralize(type) : type,
        ids: id,
        relatedField: field
      }),
      type: schemaField[keys.link]
    }, schemaField[keys.isArray] ?
      { ids: ids.map(toString) } : { id: ids.toString() });
  }

  return record;
}


/*!
 * Internal function to determine the action based on the HTTP method,
 * there are edge cases in which PUT and PATCH can create records.
 */
function determineAction (context, request) {
  let handler = handlers[request.method];

  return typeof handler === 'function' ? handler(...arguments) : handler;
}
