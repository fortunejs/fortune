import * as Errors from '../../utils/errors';
import enforce from '../../schemas/enforcer';
import keys from '../../schemas/reserved_keys';

/*!
 * Extend context so that it includes the parsed entities and create them.
 * This mutates the original request and response object.
 *
 * @return {Promise}
 */
export default function (context) {
  let originalType = context.request._originalType;
  let originalIds = context.request._originalIds;
  let relatedField = context.request.relatedField;
  let isRelated = !!originalType && !!originalIds && !!relatedField;
  let isArray = originalType && relatedField ?
    this.schemas[originalType][relatedField][keys.isArray] : undefined;

  // Block the request if IDs exist, unless it's adding to an array
  // on a related field.
  if (context.request.ids.length) {
    if (isRelated && !isArray) {
      throw new Errors.ConflictError('Entity already exists.');
    } else if (!isRelated) {
      throw new Errors.BadRequestError('Cannot specify ID on creation.');
    }
  }

  let type = context.request.type;
  let entities = this.serializer.parseCreate(context);

  if (!entities.length)
    throw new Errors.BadRequestError(
      'There are no valid entities in the request.');

  return Promise.all(entities.map(entity => {

    // Enforce the schema before running transform.
    entity = enforce(entity, this.schemas[type], false);

    // Do before transforms.
    return new Promise(resolve => resolve(
      'before' in (this.transforms[type] || {}) ?
        this.transforms[type].before.call(entity, context) : entity));

  })).then(entities => {
    // Block request if there are too many entities for the schema.
    if (isRelated && !isArray && entities.length > 1)
      throw new Errors.ConflictError('Too many entities requested to ' +
          'be created, only one allowed.');

    return this.adapter.create(type, entities);

  }).then(entities => {
    context.response._entities = entities;

    // If there is a related type and IDs, try to attach it.
    if (isRelated) {
      let updates = originalIds.map(id => {
        let updateObject = {
          id: id
        };
        if (isArray) {
          updateObject.add = {};
          updateObject.add[relatedField] = entities.map(entity =>
            entity[this.options.primaryKey]);
        } else {
          updateObject.replace = {};
          updateObject.replace[relatedField] =
            entities[0][this.options.primaryKey];
        }
        return updateObject;
      });
      return this.adapter.update(originalType, updates);
    } else {
      return [];
    }

  }).then((updatedEntities) => {
    return context;
  });
}
