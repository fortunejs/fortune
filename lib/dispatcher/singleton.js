import Dispatcher from './';
import excludedKeys from '../common/excluded_keys';

/*!
 * A singleton for the dispatcher. For internal use.
 */
export default class extends Dispatcher {
  constructor (context) {
    super({
      // This gives us only the generic options.
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
