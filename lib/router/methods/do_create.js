import * as Errors from '../../common/errors';
import { Enforcer as enforce, ReservedKeys as keys } from '../../schema';

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
  let transaction;

  if (!entities.length)
    throw new Errors.BadRequestError(
      `There are no valid entities in the request.`);

  return Promise.all(entities.map(entity => {

    // Enforce the schema before running transform.
    entity = enforce(entity, this.schemas[type],
      Object.assign(options.schema, { output: false }));

    // Do before transforms.
    return new Promise(resolve => resolve(
      'before' in (this.transforms[type] || {}) ?
        this.transforms[type].before(context, entity) : entity));

  })).then(transformedEntities => {
    // Block request if there are too many entities for the schema.
    if (isRelated && !isArray && transformedEntities.length > 1)
      throw new Errors.ConflictError(`Too many entities requested to ` +
        `be created, only one allowed.`);

    return this.adapter.beginTransaction().then(t => {
      transaction = t;
      return transaction.create(type, transformedEntities);
    });

  }).then(createdEntities => {
    if (!createdEntities.length) {
      throw new Errors.BadRequestError(`Entities could not be created.`);
    }

    entities = createdEntities;

    // If there is a directly related type and IDs, try to attach it.
    if (isRelated) {
      let updates = originalIds.map(id => {
        let primaryKey = originalType in options.primaryKeyPerType ?
          options.primaryKeyPerType[originalType] : options.primaryKey;

        let updateObject = {
          id: id
        };

        if (isArray) {
          updateObject.add = {};
          updateObject.add[relatedField] = createdEntities.map(entity =>
            entity[primaryKey]);
        } else {
          updateObject.replace = {};
          updateObject.replace[relatedField] =
            createdEntities[0][primaryKey];
        }

        return updateObject;
      });

      return transaction.update(originalType, updates);
    } else {
      return [];
    }

  }).then(() => {
    // Update inversely linked entities on created entities.
    // This is not quite easy, trying to batch updates to be
    // as few as possible.
    let primaryKey = type in options.primaryKeyPerType ?
      options.primaryKeyPerType[type] : options.primaryKey;
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
    entities.forEach(entity => {
      for (let field in links) {
        let inverseField = schema[field][keys.inverse];
        if (field in entity && !!inverseField) {
          let linkedType = schema[field][keys.link];
          let linkedIds = entity[field];

          linkedIds.forEach(id => {
            let update;

            if (id in idCache[linkedType]) {
              update = updates[linkedType].find(update => update.id === id);
            } else {
              update = { id: id };
              updates[linkedType].push(update);
              idCache[linkedType][id] = true;
            }

            if (Array.isArray(linkedIds)) {
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

    return Promise.all(Object.keys(updates).map(type => {
      return updates[type].length ?
        transaction.update(type, updates[type]) : Promise.resolve([]);
    }));

  }).then(() => {
    return transaction.endTransaction().then(() => {
      context.response._entities = entities;
      return context;
    });
  });
}
