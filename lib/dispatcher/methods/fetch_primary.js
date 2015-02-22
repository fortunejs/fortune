import * as Errors from '../../common/errors';

/*!
 * Fetch the primary entities. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let ids = context.request.ids;
  let options = Object.assign(context.request.options,
    type in context.request.optionsPerType ?
    context.request.optionsPerType[type] : {});

  return this.adapter.find(type, ids, options).then(entities => {
    // If we got nothing, there's a problem.
    if (!entities.length)
      throw new Errors.NotFoundError(`No primary entities match the request.`);

    context.response._entities = entities;
    return context;
  });
}
