import keys from '../../schema/reserved_keys';
import enforce from '../../schema/enforce';
import primaryKey from '../../common/primary_key';
import errors from '../../common/errors';
import * as arrayProxy from '../../common/array_proxy';


/*!
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let records = this.serializer.parseCreate(context);
  let transaction;
  let updates = {};

  if (!records.length)
    throw new errors.BadRequestError(
      `There are no valid records in the request.`);

  return Promise.all(records.map(record => {
    // Enforce the schema before running transform.
    record = enforce(record, this.schemas[type]);

    // Do before transforms.
    return new Promise(resolve => resolve(
      (this.transforms[type] || {}).hasOwnProperty('before') ?
        this.transforms[type].before(context, record) : record));

  })).then(transformedRecords =>
    this.adapter.beginTransaction().then(t => {
      transaction = t;
      return transaction.create(type, transformedRecords);
    })

  ).then(createdRecords => {
    // Adapter must return something.
    if (!createdRecords.length)
      throw new errors.BadRequestError(`Records could not be created.`);

    // Each created record must have an ID.
    if (arrayProxy.find(createdRecords, record =>
      !record.hasOwnProperty(primaryKey)))
        throw new Error(`ID on created record is missing.`);

    // Update inversely linked records on created records.
    // Trying to batch updates to be as few as possible.
    let schema = this.schemas[type];
    let links = schema._links;
    let idCache = {};

    // Do some initialization.
    links.forEach(field => {
      if (schema[field][keys.inverse]) {
        let linkedType = schema[field][keys.link];
        updates[linkedType] = [];
        idCache[linkedType] = new Set();
      }
    });

    // Loop over each record to generate updates object.
    createdRecords.forEach(record => {
      links.forEach(field => {
        let inverseField = schema[field][keys.inverse];

        if (record.hasOwnProperty(field) && inverseField) {
          let linkedType = schema[field][keys.link];
          let linkedIsArray = this.schemas[linkedType]
            [inverseField][keys.isArray];
          let linkedIds = Array.isArray(record[field]) ?
            record[field]: [record[field]];

          linkedIds.forEach(id => {
            let update;

            if (idCache[linkedType].has(id)) {
              update = arrayProxy.find(updates[linkedType],
                update => update.id === id);
            } else {
              update = { id };
              updates[linkedType].push(update);
              idCache[linkedType].add(id);
            }

            if (linkedIsArray) {
              update.push = update.push || {};
              update.push[inverseField] = update.push[inverseField] || [];
              update.push[inverseField].push(record[primaryKey]);
            } else {
              update.set = update.set || {};
              update.set[inverseField] = record[primaryKey];
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

  }).then(() => transaction.endTransaction())

  .then(() => {
    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    });

    // Summarize changes during the lifecycle of the request.
    this.emit(this._changeEvent, Object.assign({
      [type]: {
        create: records.map(record => record[primaryKey])
      }
    }, Object.keys(updates).reduce((types, type) => {
      if (updates[type].length)
        types[type] = {
          update: updates[type].map(update => update.id)
        };

      return types;
    }, {})));

    return context;
  });
}
