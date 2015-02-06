import * as Errors from '../../common/errors';

/*!
 * Dispatch a request.
 *
 * @param {Object} context
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let ids = context.request.ids;
  let action = context.request.action;
  let actions = {

    create: () => {
      return this._fetchRelated(context)
        .then(context => this._doCreate(context))
        .then(context => this._processResponse(context))
        .then(context => context.response);
    },

    find: () => {
      if (!type) {
        // Show the index, not much to process here.
        return new Promise(resolve => {
          context = this.serializer.showIndex(context);
          return resolve(context.response);
        });
      } else {
        // Fetch something.
        return this._fetchRelated(context)
          .then(context => this._fetchPrimary(context))
          .then(context => this._fetchInclude(context))
          .then(context => this._processResponse(context))
          .then(context => context.response);
      }
    },

    // TODO
    update: () => undefined,

    // TODO
    delete: () => undefined

  };

  // Make sure IDs are unique values.
  let idCache = {};
  context.request.ids = (Array.isArray(ids) ? ids : [ids]).filter(id =>
    id in idCache ? false : (idCache[id] = true));

  // Block request if type is invalid.
  if (action !== 'find' && !(type in this.schemas))
    throw new Errors.NotFoundError(`The requested type "${type}"
      is not a valid type.`);

  // Try to process the request.
  try {
    context = this.serializer.processRequest(context);
  } catch (error) {
    throw new Error(`There was an error processing the request.`);
  }

  if (action in actions) {
    return actions[action]();
  } else if (typeof action === 'function') {
    return new Promise(resolve => resolve(action.bind(this)(context)));
  } else {
    throw new Errors.MethodError(`The action type "${action}"
      is unrecognized.`);
  }
}
