import Router from '../router';
import nestedOptions from './nested_options';

/*!
 * A singleton for the router. For internal use.
 */
export default class extends Router {
  constructor (context) {
    super({

      // This gives us only generic options.
      options: Object.keys(context.options).reduce((options, key) => {
        if (!(key in nestedOptions))
          options[key] = context.options[key];
        return options;
      }, {}),

      schemas: context.schemas,
      transforms: context.transforms,
      adapter: context.adapter,
      serializer: context.serializer
    });
  }
}
