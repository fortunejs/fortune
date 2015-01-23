import * as Errors from '../../utils/errors';

/*!
 * Dispatch a request.
 *
 * @param {Object} context
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let action = context.request.action;
  let actions = {

    create: () => undefined,

    find: () => {
      if (!type) {
        // Show the index, not much to process here.
        return new Promise(resolve => {
          this.serializer.showIndex(context);
          return resolve(context.response);
        });
      } else if (type in this.schemas) {
        // First things first, if a related field is specified, look up the
        // related field, then mutate the request with the related type and
        // corresponding IDs specified. If there are no IDs, then assume it's
        // missing and return an error. Not all errors are bad errors.
        return new Promise(resolve => resolve(!!context.request.relatedField ?
          this._fetchRelated(context) : context))
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

  try {
    return actions[action]();
  } catch (error) {
    throw new errors.MethodError('The action type "' + action +
      '" is unrecognized.');
  }
}
