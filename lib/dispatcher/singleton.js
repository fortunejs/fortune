import Dispatcher from './';
import excludedKeys from '../common/excluded_keys';

/*!
 * A singleton for the dispatcher. For internal use.
 */
export default class DispatcherSingleton extends Dispatcher {

  constructor (core) {
    super({
      // This gives us only the generic options.
      options: Object.keys(core.options).reduce((options, key) => {
        if (!(key in excludedKeys))
          options[key] = core.options[key];
        return options;
      }, {}),
      schemas: core.schemas,
      transforms: core.transforms,
      adapter: core.adapter,
      serializer: core.serializer
    });
  }

}
