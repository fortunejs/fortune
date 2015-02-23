import * as Errors from '../../common/errors';
import keys from '../../schema/reserved_keys';
import enforcer from '../../schema/enforcer';

const changeEvent = 'change';

/*!
 * Extend context so that it includes the parsed entities and create them.
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
  let entities = this.serializer.parseCreate(context);
  let primaryKey = type in options.primaryKeyPerType ?
    options.primaryKeyPerType[type] : options.primaryKey;
  let transaction, inverseField;

  if (!entities.length)
    throw new Errors.BadRequestError(
      `There are no valid entities in the request.`);

  if (isRelated) {
    inverseField = this.schemas[originalType][relatedField][keys.inverse];

    // Block request if there are too many entities for the schema,
    // in the case of a to-one relationship.
    if (!isArray && entities.length > 1)
      throw new Errors.ConflictError(`Too many entities requested to ` +
        `be created, only one allowed.`);

    // Block request if schema doesn't allow for to-many and multiple
    // original IDs are requested.
    if (!this.schemas[type][inverseField][keys.isArray] &&
      originalIds.length > 1)
        throw new Errors.ConflictError(`Cannot specify multiple IDs for a ` +
          `to-one relationship.`);

    // Block request if the inverse of the related field is specified.
    if (entities.find(entity => inverseField in entity))
      throw new Errors.ConflictError(`Cannot specify the inverse field ` +
        `"${inverseField}" on the entity if related field is specified.`);
  }

  return Promise.all(entities.map(entity => {
    let id = entity[primaryKey];

    // Enforce the schema before running transform.
    entity = enforcer(entity, this.schemas[type],
      Object.assign(options.schema, { output: false }));

    // Re-attach ID.
    if (id)
      entity[primaryKey] = id;

    // Attach related field.
    if (isRelated)
      entity[inverseField] = this.schemas[type][inverseField]
        [keys.isArray] ? originalIds : originalIds[0];

    // Do before transforms.
    return new Promise(resolve => resolve(
      'before' in (this.transforms[type] || {}) ?
        this.transforms[type].before(context, entity) : entity));

  })).then(transformedEntities =>
    this.adapter.beginTransaction().then(t => {
      transaction = t;
      return transaction.create(type, transformedEntities);
    }
  )).then(createdEntities => {
    if (!createdEntities.length) {
      throw new Errors.BadRequestError(`Entities could not be created.`);
    }

    if (createdEntities.find(entity => !(primaryKey in entity)))
      throw new Error(`ID on created entity is missing.`);

    // Update inversely linked entities on created entities.
    // This is not quite easy, trying to batch updates to be
    // as few as possible.
    let schema = this.schemas[type];
    let links = schema._links;
    let updates = {};
    let idCache = {};

    // Do some initialization.
    for (let field in links) {
      if (!!schema[field][keys.inverse]) {
        let linkedType = schema[field][keys.link];
        updates[linkedType] = updates[linkedType] || [];
        idCache[linkedType] = idCache[linkedType] || {};
      }
    }

    // Loop over each entity to generate updates object.
    createdEntities.forEach(entity => {
      for (let field in links) {
        let inverseField = schema[field][keys.inverse];
        if (field in entity && !!inverseField) {
          let linkedType = schema[field][keys.link];
          let linkedIsArray = this.schemas[linkedType]
            [inverseField][keys.isArray];
          let linkedIds = Array.isArray(entity[field]) ?
            entity[field]: [entity[field]];

          linkedIds.forEach(id => {
            let update;

            if (id in idCache[linkedType]) {
              update = updates[linkedType].find(update => update.id === id);
            } else {
              update = { id: id };
              updates[linkedType].push(update);
              idCache[linkedType][id] = true;
            }

            if (linkedIsArray) {
              update.add = update.add || {};
              update.add[inverseField] = update.add[inverseField] || [];
              update.add[inverseField].push(entity[primaryKey]);
            } else {
              update.replace = update.replace || {};
              update.replace[inverseField] = entity[primaryKey];
            }
          });
        }
      }
    });

    return Promise.all(Object.keys(updates).map(type =>
      updates[type].length ?
        transaction.update(type, updates[type]) :
        Promise.resolve([])
    ));

  }).then(() => {
    return transaction.endTransaction().then(() => {
      context.response._entities = entities;

      this.emit(changeEvent, {
        action: context.request.action,
        type: context.request.type,
        ids: entities.map(entity => entity[primaryKey])
      });

      return context;
    });
  });
}
