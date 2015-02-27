import Adapter from './';
import excludedKeys from '../common/excluded_keys';


/**
 * A singleton for the adapter. For internal use.
 */
export default class AdapterSingleton extends Adapter {

  constructor (core) {
    let type = core.options.adapter.type;

    if (typeof type === 'function')
      type = type(Adapter);

    if (!type.prototype ||
      Object.getPrototypeOf(type.prototype) !== Adapter.prototype)
      throw new Error(`The "type" must be a class ` +
        `that extends Adapter.`);

    return new type(Object.assign({
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
