/**
 * Do I/O.
 */
export default class Router {
  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * This is the primary method for doing I/O. It is mostly decoupled
   * from HTTP, except for `headers` and `statusCode`.
   *
   * @param {Object} options
   * @return {Promise}
   */
  request (options) {
    const context = {
      request: {
        action: 'read',
        query: {},
        type: '',
        ids: [],
        related: '',
        serializer: '',
        headers: {},
        payload: ''
      },
      response: {
        serializer: '',
        headers: {},
        statusCode: 200,
        payload: ''
      }
    };

    Object.assign(context.request, options);
  }
}


/**
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
