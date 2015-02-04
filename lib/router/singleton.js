import Router from './';
import excludedKeys from '../common/excluded_keys';

/*!
 * A singleton for the router. For internal use.
 */
export default class extends Router {
  constructor (context) {
    super({

      // This gives us only generic options.
      options: Object.keys(context.options).reduce((options, key) => {
        if (!(key in excludedKeys))
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
