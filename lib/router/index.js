import * as methods from './methods';

/**
 * Delegate I/O tasks to each submodule.
 */
export default class Router {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * This is the primary method for doing I/O. It is decoupled from any
   * protocol such as HTTP. The request object must be formatted as follows:
   *
   * ```js
   * {
   *   // May be `create`, `find`, `update`, or `delete`. Corresponds
   *   // directly to adapter method.
   *   action: 'find',
   *
   *   type: '', // Name of a resource type.
   *   ids: [], // An array of IDs.
   *
   *   // A field that is a link on the resource type. This will rewrite
   *   // the original type and IDs if this is specified.
   *   relatedField: '',
   *
   *   // A 2-dimensional array specifying what to include. The first
   *   // dimension is a list, the second dimension is depth. For example:
   *   // [['comments'], ['comments', 'author']]
   *   include: [],
   *
   *   // Exactly the same as the adapter's `find` method options.
   *   // The options apply only to the primary type, and not include.
   *   options: { ... },
   *
   *   // The name of the serializer to use for the input (request).
   *   serializerInput: '',
   *
   *   // The name of the serializer to use for the output (response).
   *   serializerOutput: '',
   *
   *   meta: {}, // Meta-info of the request.
   *   payload: '' // Payload of the request. String or buffer.
   * }
   * ```
   *
   * The response object is wrapped in a `Promise`, and is much simpler:
   *
   * ```js
   * {
   *   meta: {}, // Meta-info of the request.
   *   statusCode: 0, // Status code to return.
   *   payload: '' // Payload of the request. String or buffer.
   * }
   * ```
   *
   * @param {Object} options
   * @return {Promise}
   */
  request (options) {
    const context = setDefaults(options);

    return new Promise(resolve => resolve(this._dispatchRequest(context)))
      .catch(error => {
        console.trace(error);
        this.serializer.showError(context, error);
        return Promise.reject(context.response);
      });
  }

}

// Assign methods to the router.
Object.assign(Router.prototype, methods);


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options) {
  const context = {
    request: {
      action: 'find',
      type: '',
      ids: [],
      relatedField: '',
      include: [],
      options: {
        query: {},
        sort: {},
        fields: {},
        match: {},
        limit: 1000,
        offset: 0
      },
      serializerInput: '',
      serializerOutput: '',
      meta: {},
      payload: ''
    },
    response: {
      meta: {},
      statusCode: 0,
      payload: ''
    }
  };

  Object.assign(context.request, options);
  return context;
}
