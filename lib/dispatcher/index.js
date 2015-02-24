import stderr from '../common/stderr';
import events from 'events';
import * as methods from './methods';

/**
 * Delegate I/O tasks to adapter and serializers. The dispatcher inherits
 * from the built-in `EventEmitter` object, and emits one event, the `change`
 * event. The argument it receives is an object with the keys `action`,
 * `type`, and `ids`. This may be useful for implementing real-time
 * updates.
 */
export default class Dispatcher extends events.EventEmitter {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * This is the primary method for initiating a workflow. It is decoupled
   * from network protocols. The request object must be formatted as follows:
   *
   * ```js
   * {
   *   // May be `create`, `find`, `update`, or `delete`. Corresponds
   *   // directly to adapter method. Alternatively, this may be a custom
   *   // function that gets bound to the dispatcher. It takes one argument,
   *   // the `context` object, and its return value must be
   *   // the `context.response` either synchronously or as a Promise.
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
   *   // A hash keyed by type, and values containing options objects.
   *   // This takes precedence over `options` above.
   *   optionsPerType: { type: { ... } },
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
   *   payload: '' // Payload of the response. String or buffer.
   * }
   * ```
   *
   * @param {Object} options
   * @param {*} [args]
   * @return {Promise}
   */
  request (options, ...args) {
    let context = setDefaults(options);

    return new Promise(resolve => resolve(
      this._dispatchRequest(context, ...args)))
      .catch(error => {
        stderr.error(error.stack || error);
        try {
          context = this.serializer.showError(context, error);
          context = this.serializer.processResponse(context);
        } catch (error) {
          context.response.payload =
            `${error.name}${!!error.message ? ': ' + error.message : ''}`;
        }
        return Promise.reject(context.response);
      });
  }

}

// Assign methods to the dispatcher.
Object.assign(Dispatcher.prototype, methods);


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options = {}) {
  let context = {
    request: {
      action: 'find',
      type: '',
      ids: [],
      relatedField: '',
      include: [],
      options: {
        filter: {},
        sort: {},
        fields: {},
        match: {},
        limit: 1000,
        offset: 0
      },
      optionsPerType: {},
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
