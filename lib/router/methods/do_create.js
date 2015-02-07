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
          options.primaryKeyPerType[originalType] :
          options.primaryKey;

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

  }).then((updatedEntities) => {
    // TODO: created entity may have additional inverse links to add to.

    return transaction.endTransaction().then(() => {
      context.response._entities = entities;
      return context;
    });
  });
}
