import Adapter from '../adapter';
import nestedOptions from './nested_options';

/**
 * A singleton for the adapter. For internal use.
 */
export default class extends Adapter {
  constructor (context) {
    let adapter = context.options.adapter.type;

    // Coerce a constructor function into its prototype.
    if (typeof adapter === 'function')
      adapter = adapter.prototype;

    super(Object.assign(adapter, {
      options: context.options.adapter.options || {},
      schemas: context.schemas
    }, {
      options: {
        // This gives us generic options merged into the
        // serializer's options under the `generic` key.
        generic: Object.keys(context.options).reduce((options, key) => {
          if (!(key in nestedOptions))
            options[key] = context.options[key];
          return options;
        }, {})
      }
    }));
  }
}
