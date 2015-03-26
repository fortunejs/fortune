import keys from '../../schema/reserved_keys';
import errors from '../../common/errors';


/*!
 * Extend request so that it includes the corresponding IDs and type.
 * This mutates the original request object.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let relatedField = context.request.relatedField;

  if (!type || !relatedField)
    return context;

  if (!this.schemas[type].hasOwnProperty(relatedField))
    throw new errors.NotFoundError(`The field "${relatedField}" is ` +
      `non-existent on the type "${type}".`);

  let ids = context.request.ids;
  let relatedType = this.schemas[type][relatedField][keys.link];
  let options = {
    fields: {
      // Only interested in the related field.
      [relatedField]: true
    }
  };

  return this.adapter.find(type, ids, options).then(records => {

    // Reduce the related IDs from all of the records into an array of
    // unique IDs.
    let relatedIds = [...(records || []).reduce((ids, record) => {
      let related = record[relatedField];

      (Array.isArray(related) ? related : [related])
        .forEach(id => ids.add(id));

      return ids;
    }, new Set())];

    // If there's no related IDs, and we're not trying to create something,
    // then something is wrong.
    if (!relatedIds.length && context.request.action !== 'create')
      throw new errors.NotFoundError(`No related records match the request.`);

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
