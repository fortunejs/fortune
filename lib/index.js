// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'

// Static exports.
import memory from './adapter/adapters/memory'
import json from './serializer/serializers/json'
import { formUrlEncoded, formData } from './serializer/serializers/form'
import http from './net/http'
import websocket from './net/websocket'


const adapters = { memory }
const serializers = { json, formUrlEncoded, formData }
const net = { http, websocket }


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
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
