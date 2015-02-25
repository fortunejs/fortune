import Adapter from './';
import excludedKeys from '../common/excluded_keys';
import enumerateMethods from '../common/enumerate_methods';


/**
 * A singleton for the adapter. For internal use.
 */
export default class extends Adapter {

  constructor (core) {
    let type = core.options.adapter.type;
    let methods = enumerateMethods(type);

    return new type(Object.assign(methods, {
      options: core.options.adapter.options || {},
      schemas: core.schemas
    }, {
      options: {
        // This gives us generic options merged into the
        // serializer's options under the `generic` key.
        generic: Object.keys(core.options).reduce((options, key) => {
          if (!(key in excludedKeys))
            options[key] = core.options[key];
          return options;
        }, {})
      }
    }));
  }

}
