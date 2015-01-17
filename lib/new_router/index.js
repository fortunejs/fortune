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
   *   action: 'read', // May be `create`, `read`, `update`, or `delete`.
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

    return this._checkRequest(context.request).then(() => {
      return this._dispatchRequest(context);
    }).catch((errors) => {
      this.serializer.showError(context, errors);
      return Promise.reject(context.response);
    });

  }

  /**
   * Check if a request object looks valid. This method isn't really
   * asynchronous, but it's nice to use Promise syntax because the error
   * handler is the same for `_dispatchRequest`. The only necessary checks
   * are those that cause problems after already doing some work. Maybe
   * this method is necessary, or maybe not.
   *
   * @return {Promise}
   */
  _checkRequest (request) {
    const actions = ['create', 'read', 'update', 'delete'];

    return new Promise((resolve, reject) => {
      let errors = [];

      // Limited to CRUD.
      if (!~actions.indexOf(request.action)) {
        errors.push(new Error('Invalid action "' +
          request.action + '".'));
      }

      // If a resource type is specified it must exist.
      if (request.type.length && !(request.type in this.schemas)) {
        errors.push(new Error('Resource type "' + request.type +
          '" does not exist.'));
      }

      // Retrieval requires deserialization.
      if (request.action === 'read' && !request.serializerOutput.length) {
        errors.push(new Error('Serializer output type must be specified ' +
          'for reading from.'));
      }

      // Request payload requires serialization.
      if (~['update', 'create'].indexOf(request.action) &&
        !request.serializerInput.length) {
          errors.push(new Error('Serializer input type must be specified ' +
            'for requests in which a payload is expected.'));
      }

      return errors.length ? reject(errors) : resolve(request);
    });
  }

  /*!
   * Dispatch a request.
   *
   * @param {Object} context
   * @return {Promise}
   */
  _dispatchRequest (context) {
    let errors = [];

    return errors.length ? reject(errors) : resolve(context.response);
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
