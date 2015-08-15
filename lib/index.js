// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'

// Static exports.
import nedb from './adapter/adapters/nedb'
import adHoc from './serializer/serializers/ad_hoc'
import http from './net/http'
import websocket from './net/websocket'


const adapters = { nedb }
const serializers = { adHoc }
const net = { http, websocket }


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
    if (typeof options !== 'object')
      throw new TypeError(`Argument "options" must be an object.`)

    if (!('adapter' in options))
      options.adapter = { type: nedb }

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
