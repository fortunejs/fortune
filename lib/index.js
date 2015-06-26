// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'

// Static exports.
import nedb from './adapter/adapters/nedb'
import microApi from './serializer/serializers/micro_api'
import jsonApi from './serializer/serializers/json_api'
import http from './net/http'


const adapters = { nedb }
const serializers = { microApi, jsonApi }
const net = { http }


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
    if (typeof options !== 'object')
      throw new TypeError(`Argument "options" must be an object.`)

    if (!('adapter' in options))
      options.adapter = { type: adapters.nedb }

    if (!('serializers' in options))
      options.serializers = Object.keys(serializers).map(name =>
        ({ type: serializers[name] }))

    super(options)
  }

  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
defineArguments(Fortune, { adapters, serializers, net })
