import Adapter from './';
import excludedKeys from '../common/excluded_keys';
import enumerateMethods from '../common/enumerate_methods';


/**
 * A singleton for the adapter. For internal use.
 */
export default class extends Adapter {
  constructor (context) {
    let type = context.options.adapter.type;
    let methods = enumerateMethods(type);

    return new type(Object.assign(methods, {
      options: context.options.adapter.options || {},
      schemas: context.schemas
    }, {
      options: {
        // This gives us generic options merged into the
        // serializer's options under the `generic` key.
        generic: Object.keys(context.options).reduce((options, key) => {
          if (!(key in excludedKeys))
            options[key] = context.options[key];
          return options;
        }, {})
      }
    }));
  }
}
