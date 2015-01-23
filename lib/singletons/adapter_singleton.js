import Adapter from '../adapter';

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
    }));
  }
}
