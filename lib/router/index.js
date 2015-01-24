import setDefaults from './set_defaults';

import dispatchRequest from './methods/dispatch_request';
import fetchRelated from './methods/fetch_related';
import fetchPrimary from './methods/fetch_primary';
import fetchInclude from './methods/fetch_include';
import processResponse from './methods/process_response';
import doCreate from './methods/do_create';

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
   *   relatedField: '', // A field that is a link on the resource type.
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
        console.log(error);
        this.serializer.showError(context, error);
        return Promise.reject(context.response);
      });
  }

}

// Assign methods to the router.
Object.assign(Router.prototype, {
  _dispatchRequest: dispatchRequest,
  _fetchRelated: fetchRelated,
  _fetchPrimary: fetchPrimary,
  _fetchInclude: fetchInclude,
  _processResponse: processResponse,
  _doCreate: doCreate
});
