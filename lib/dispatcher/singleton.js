import Dispatcher from './';


/*!
 * A singleton for the dispatcher. For internal use.
 */
export default class DispatcherSingleton extends Dispatcher {

  constructor (core) {
    super({
      schema: core.options.schema,
      schemas: core.schemas,
      transforms: core.transforms,
      adapter: core.adapter,
      serializer: core.serializer
    });
  }

}
