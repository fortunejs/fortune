/*!
 * Extend request so that it includes the corresponding IDs and type.
 * This mutates the original request object.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let ids = context.request.ids;
  let relatedField = context.request.relatedField;
  let relatedType = this.schemas[type]
    [relatedField][keys.link];
  let options = {
    fields: {}
  };

  // Only interested in the related field.
  options.fields[relatedField] = 1;

  return this.adapter.find(type, ids, options).then(entities => {

    // Reduce the related IDs from all of the entities into an array of
    // unique IDs.
    let relatedIds = (entities || []).reduce((array, entity) => {
      let entityIds = Array.isArray(entity[relatedField]) ?
        entity[relatedField] || [] : [entity[relatedField]];

      // This makes the assumption that related IDs per entity
      // are already unique.
      array.push(...entityIds.filter(id => !!id && !~array.indexOf(id)));

      return array;
    }, []);

    // If there's no related IDs, something's wrong.
    if (!relatedIds.length)
      throw new Error('No related documents match the request.');

    // Write the related info to the request, which should take precedence
    // over the original type and IDs.
    context.request._relatedType = relatedType;
    context.request._relatedIds = relatedIds;

    return context;
  });
}
