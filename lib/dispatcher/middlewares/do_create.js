import keys from '../../schema/reserved_keys';
import enforcer from '../../schema/enforcer';
import * as errors from '../../common/errors';
import * as arrayProxy from '../../common/array_proxy';


/*!
 * Extend context so that it includes the parsed records and create them.
 * This mutates the original request and response object.
 *
 * @return {Promise}
 */
export default function (context) {
  let options = this.options;
  let originalType = context.request._originalType;
  let originalIds = context.request._originalIds;
  let relatedField = context.request.relatedField;
  let isRelated = !!originalType && !!originalIds && !!relatedField;
  let isArray = originalType && relatedField ?
    this.schemas[originalType][relatedField][keys.isArray] : undefined;
  let type = context.request.type;
  let records = this.serializer.parseCreate(context);
  let primaryKey = type in options.primaryKeyPerType ?
    options.primaryKeyPerType[type] : options.primaryKey;
  let transaction, inverseField;
  let updates = {};

  if (!records.length)
    throw new errors.BadRequestError(
      `There are no valid records in the request.`);

  if (isRelated) {
    inverseField = this.schemas[originalType][relatedField][keys.inverse];

    // Block request if there are too many records for the schema,
    // in the case of a to-one relationship.
    if (!isArray && records.length > 1)
      throw new errors.ConflictError(`Too many records requested to ` +
        `be created, only one allowed.`);

    // Block request if schema doesn't allow for to-many and multiple
    // original IDs are requested.
    if (!this.schemas[type][inverseField][keys.isArray] &&
      originalIds.length > 1)
        throw new errors.ConflictError(`Cannot specify multiple IDs for a ` +
          `to-one relationship.`);

    // Block request if the inverse of the related field is specified.
    if (arrayProxy.find(records, record => inverseField in record))
      throw new errors.ConflictError(`Cannot specify the inverse field ` +
        `"${inverseField}" on the record if related field is specified.`);
  }

  return Promise.all(records.map(record => {
    let id = record[primaryKey];

    // Enforce the schema before running transform.
    record = enforcer(record, this.schemas[type],
      Object.assign(options.schema, { output: false }));

    // Re-attach ID.
    if (id)
      record[primaryKey] = id;

    // Attach related field.
    if (isRelated)
      record[inverseField] = this.schemas[type][inverseField]
        [keys.isArray] ? originalIds : originalIds[0];

    // Do before transforms.
    return new Promise(resolve => resolve(
      'before' in (this.transforms[type] || {}) ?
        this.transforms[type].before(context, record) : record));

  })).then(transformedrecords =>
    this.adapter.beginTransaction().then(t => {
      transaction = t;
      return transaction.create(type, transformedrecords);
    }
  )).then(createdrecords => {
    if (!createdrecords.length) {
      throw new errors.BadRequestError(`records could not be created.`);
    }

    if (arrayProxy.find(createdrecords, record => !(primaryKey in record)))
      throw new Error(`ID on created record is missing.`);

    // Update inversely linked records on created records.
    // This is not quite easy, trying to batch updates to be
    // as few as possible.
    let schema = this.schemas[type];
    let links = schema._links;
    let idCache = {};

    // Do some initialization.
    for (let field in links) {
      if (schema[field][keys.inverse]) {
        let linkedType = schema[field][keys.link];
        updates[linkedType] = updates[linkedType] || [];
        idCache[linkedType] = idCache[linkedType] || {};
      }
    }

    // Loop over each record to generate updates object.
    createdrecords.forEach(record => {
      Object.keys(links).forEach(field => {
        let inverseField = schema[field][keys.inverse];
        if (field in record && !!inverseField) {
          let linkedType = schema[field][keys.link];
          let linkedIsArray = this.schemas[linkedType]
            [inverseField][keys.isArray];
          let linkedIds = Array.isArray(record[field]) ?
            record[field]: [record[field]];

          linkedIds.forEach(id => {
            let update;

            if (id in idCache[linkedType]) {
              update = arrayProxy.find(updates[linkedType],
                update => update.id === id);
            } else {
              update = { id: id };
              updates[linkedType].push(update);
              idCache[linkedType][id] = true;
            }

            if (linkedIsArray) {
              update.add = update.add || {};
              update.add[inverseField] = update.add[inverseField] || [];
              update.add[inverseField].push(record[primaryKey]);
            } else {
              update.replace = update.replace || {};
              update.replace[inverseField] = record[primaryKey];
            }
          });
        }
      });
    });

    return Promise.all(Object.keys(updates).map(type =>
      updates[type].length ?
        transaction.update(type, updates[type]) :
        Promise.resolve([])
    ));

  }).then(() => {
    return transaction.endTransaction().then(() => {
      context.response.payload.records = records;

      // Summarize changes during the lifecycle of the request.
      this.emit(this._changeEvent, Object.assign({
        timestamp: Date.now(),
        [type]: {
          create: records.map(record => record[primaryKey])
        }
      }, Object.keys(updates).reduce((types, type) => {
        types[type] = {
          update: updates[type].map(update => update.id)
        };

        return types;
      }, {})));

      return context;
    });
  });
}
