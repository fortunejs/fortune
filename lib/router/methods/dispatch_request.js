import * as Errors from '../../utils/errors';

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
      if (type in this.schemas) {
        return this._fetchRelated(context)
          .then(context => this._doCreate(context))
          .then(context => this._processResponse(context))
          .then(context => context.response);
      } else {
        throw new Errors.NotFoundError('The requested type "' + type +
          '" is not a valid type.');
      }
    },

    find: () => {
      if (!type) {
        // Show the index, not much to process here.
        return new Promise(resolve => {
          this.serializer.showIndex(context);
          return resolve(context.response);
        });
      } else if (type in this.schemas) {
        return this._fetchRelated(context)
          .then(context => this._fetchPrimary(context))
          .then(context => this._fetchInclude(context))
          .then(context => this._processResponse(context))
          .then(context => context.response);
      } else {
        throw new Errors.NotFoundError('The requested type "' + type +
          '" is not a valid type.');
      }
    },

    update: () => undefined,

    delete: () => undefined

  };

  // Make sure IDs are unique values.
  let idCache = {};
  context.request.ids = (Array.isArray(ids) ? ids : [ids]).filter(id =>
    id in idCache ? false : (idCache[id] = true));

  if (action in actions) {
    return actions[action]();
  } else {
    throw new Errors.MethodError('The action type "' + action +
      '" is unrecognized.');
  }
}
