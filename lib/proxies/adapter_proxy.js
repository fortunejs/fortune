import Adapter from '../adapter';

/**
 * A proxy for the adapter. For internal use.
 */
export default class AdapterProxy extends Adapter {
  constructor (context) {
    let adapter = context.options.adapter.type;

    // Coerce a constructor function into its prototype.
    if (typeof adapter === 'function')
      adapter = adapter.prototype;

    super(Object.assign(adapter, {
      options: context.options.adapter.options || {},
      schemas: context.schemas
    }));
  }
}
