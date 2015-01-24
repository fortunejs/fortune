import * as Errors from '../../utils/errors';
import keys from '../../schemas/reserved_keys';

/*!
 * Extend request so that it includes the corresponding IDs and type.
 * This mutates the original request object.
 *
 * @return {Promise}
 */
export default function (context) {
  let relatedField = context.request.relatedField;

  if (!relatedField)
    return Promise.resolve(context);

  let type = context.request.type;
  let ids = context.request.ids;
  let relatedType = this.schemas[type][relatedField][keys.link];
  let options = {
    fields: {}
  };

  // Only interested in the related field.
  options.fields[relatedField] = 1;

  return this.adapter.find(type, ids, options).then(entities => {
    let idCache = {};

    // Reduce the related IDs from all of the entities into an array of
    // unique IDs.
    let relatedIds = (entities || []).reduce((ids, entity) => {

      (Array.isArray(entity[relatedField]) ?
        entity[relatedField] : [entity[relatedField]]).forEach(id => {
          if (!!id && !(id in idCache)) {
            idCache[id] = true;
            ids.push(id);
          }
        });

      return ids;
    }, []);

    // If there's no related IDs, and we're not trying to create something,
    // then something is wrong.
    if (!relatedIds.length && context.request.action !== 'create')
      throw new Errors.NotFoundError('No related entities match the request.');

    // Copy the original type and IDs to other keys.
    context.request._originalType = context.request.type;
    context.request._originalIds = context.request.ids;

    // Write the related info to the request, which should take precedence
    // over the original type and IDs.
    context.request.type = relatedType;
    context.request.ids = relatedIds;

    return context;
  });
}
