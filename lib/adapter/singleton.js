import Adapter from './';


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
    }));
  }

}
