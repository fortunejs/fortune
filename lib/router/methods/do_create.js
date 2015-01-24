import * as Errors from '../../utils/errors';
import enforce from '../../schemas/enforcer';

/*!
 * Extend context so that it includes the parsed entities and create them.
 * This mutates the original request and response object.
 *
 * @return {Promise}
 */
export default function (context) {
  if (context.request.ids.length) {
    if ('_originalIds' in context.request) {
      throw new Errors.ConflictError('Entity already exists.');
    } else {
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

    // If there is a related type and IDs, try to attach it.
    // TODO

    return new Promise(resolve => resolve(
      'before' in (this.transforms[type] || {}) ?
        this.transforms[type].before.call(entity, context) : entity));

  })).then(entities => {
    return this.adapter.create(type, entities);

  }).then(entities => {
    context.response._entities = entities;
    return context;
  });
}
