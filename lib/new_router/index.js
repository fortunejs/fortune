import {keys as schemaKeys} from '../schemas/parser';

/**
 * Delegate tasks to each submodule.
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
   *   // May be `create`, `read`, `update`, or `delete`. Corresponds
   *   // directly to adapter method.
   *   action: 'read',
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

    return this._dispatchRequest(context).catch((error) => {
      this.serializer.showError(context, error);
      return Promise.reject(context.response);
    });

  }

  /*!
   * Dispatch a request.
   *
   * @param {Object} context
   * @return {Promise}
   */
  _dispatchRequest (context) {
    // First things first, look up related field, then rewrite the request
    // as if we're getting the related type with IDs specified. If there
    // are no IDs, assume it's missing.
    return Promise.resolve(context.relatedField.length ?
      this._fetchRelated(context) : context)
    .then((context) => {
      // TODO
    });
  }

  /**
   * Rewrite request so that it includes the correct IDs and type.
   *
   * @return {Promise}
   */
  _fetchRelated (context) {
    let relatedType = this.schemas[context.type]
      [context.relatedField][schemaKeys.link];

    console.log(relatedType);

    return;
  }
}


/*!
 * A proxy for the router. For internal use.
 */
export class RouterProxy extends Router {
  constructor (context) {
    super({
      options: context.options.router,
      schemas: context.schemas,
      transforms: context.transforms,
      adapter: context.adapter,
      serializer: context.serializer
    });
  }
}


/*!
 * Set default options on a context's request. For internal use.
 */
function setDefaults (options) {
  const context = {
    request: {
      action: 'read',
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
