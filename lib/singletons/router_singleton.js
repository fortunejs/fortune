import Router from '../router';

/*!
 * A singleton for the router. For internal use.
 */
export default class extends Router {
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
