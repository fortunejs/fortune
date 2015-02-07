import * as Errors from '../../common/errors';

/*!
 * Dispatch a request.
 *
 * @param {Object} context
 * @param {*} [args]
 * @return {Promise}
 */
export default function (context, ...args) {
  let response, type, ids, action;
  let idCache = {};

  let actions = {

    create: () => {
      return this._fetchRelated(context)
        .then(context => this._doCreate(context))
        .then(context => this._processResponse(context));
    },

    find: () => {
      if (!type) {
        // Show the index, not much to process here.
        return new Promise(resolve => {
          context = this.serializer.showIndex(context);
          return resolve(context);
        });
      } else {
        // Fetch something.
        return this._fetchRelated(context)
          .then(context => this._fetchPrimary(context))
          .then(context => this._fetchInclude(context))
          .then(context => this._processResponse(context));
      }
    },

    // TODO
    update: () => undefined,

    // TODO
    delete: () => undefined

  };

  // Try to process the request.
  try {
    context = this.serializer.processRequest(context, ...args);
    type = context.request.type;
    ids = context.request.ids;
    action = context.request.action;
  } catch (error) {
    throw new Error(`There was an error processing the request.`);
  }

  // Make sure IDs are unique values.
  context.request.ids = (Array.isArray(ids) ? ids : [ids]).filter(id =>
    id in idCache ? false : (idCache[id] = true));

  // Block request if type is invalid.
  if ((action !== 'find' || !!type) && !(type in this.schemas))
    throw new Errors.NotFoundError(`The requested type "${type}" ` +
      `is not a valid type.`);

  if (action in actions) {
    response = actions[action]();
  } else if (typeof action === 'function') {
    response = new Promise(resolve => resolve(action.bind(this)(context)));
  } else {
    throw new Errors.MethodError(`The action type "${action}" ` +
      `is unrecognized.`);
  }

  return response.then(context => {

    // Try to process the response.
    try {
      context = this.serializer.processResponse(context, ...args);
    } catch (error) {
      throw new Error(`There was an error processing the response.`);
    }

    return context.response;
  });
}
