import * as Errors from '../../utils/errors';
import enforce from '../../schemas/enforcer';

/*!
 * Extend context so that it includes the parsed entities and create them.
 * This mutates the original request and response object.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;

  if (context.request.ids.length) {
    if ('_originalIds' in context.request) {
      throw new Errors.ConflictError('Entity already exists.');
    } else {
      throw new Errors.BadRequestError('Cannot specify ID on creation.');
    }
  }

  context.request._entities = this.serializer.parseCreate(context);

  if (!context.request._entities.length)
    throw new Errors.BadRequestError(
      'There are no valid entities in the request.');

  // Enforce the schema before running transform.
  context.request._entities = context.request._entities.map(entity =>
    enforce(entity, this.schemas[type], false));

  return ('before' in this.transforms[type] ?
    Promise.all(context.request._entities.map(entity =>
      new Promise(resolve(
        this.transforms[type].before.call(entity, context)
      ))
    )) : Promise.resolve(context.request._entities))

    .then(entities => {
      return this.adapter.create(type, entities);
    })

    .then(entities => {
      context.response._entities = entities;
      return context;
    });
}
