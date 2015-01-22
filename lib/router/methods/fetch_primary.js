/*!
 * Fetch the primary entities. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request._relatedType || context.request.type;
  let ids = context.request._relatedIds || context.request.ids;
  let options = context.request.options;

  return this.adapter.find(type, ids, options).then(entities => {
    // If we got nothing, there's a problem.
    if (!entities.length)
      throw new Error('No primary entities match the request.');

    context.response._entities = entities;
    return context;
  });
}
