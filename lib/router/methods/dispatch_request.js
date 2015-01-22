/*!
 * Dispatch a request.
 *
 * @param {Object} context
 * @return {Promise}
 */
export default function (context) {
  let actions = {

    create: () => undefined,

    find: () =>
      // First things first, if a related field is specified, look up the
      // related field, then mutate the request with the related type and
      // corresponding IDs specified. If there are no IDs, then assume it's
      // missing and return an error. Not all errors are bad errors.
      new Promise(resolve => resolve(!!context.request.relatedField ?
        this._fetchRelated(context) : context))
        .then(context => this._fetchPrimary(context))
        .then(context => this._fetchInclude(context))
        .then(context => this._processResponse(context))
        .then(context => context.response),

    update: () => undefined,

    delete: () => undefined

  };

  return actions[context.request.action]();
}
