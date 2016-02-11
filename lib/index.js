'use strict'

var Promise = require('bluebird')

// Local modules.
var Core = require('./core')
var promise = require('./common/promise')
var assign = require('./common/assign')
var map = require('./common/array/map')

// Static exports.
var memory = require('./adapter/adapters/memory')
var json = require('./net/http_json_serializer')
var form = require('./net/http_form_serializer')
var http = require('./net/http_server')
var ws = require('./net/websocket_server')
var request = require('./net/websocket_request')
var sync = require('./net/websocket_sync')


var adapters = {
  memory: memory
}

var serializers = {
  json: json,
  formUrlEncoded: form.formUrlEncoded,
  formData: form.formData
}

var net = {
  http: http,
  ws: ws,
  request: request,
  sync: sync
}


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune)) return new Fortune(recordTypes, options)

  if (options === void 0) options = {}

  if (!('serializers' in options))
    options.serializers = map(Object.keys(serializers), function (name) {
      return { type: serializers[name] }
    })

  this.constructor(recordTypes, options)
}


Fortune.prototype = Object.create(Core.prototype)
assign(Fortune, Core)


// Assigning the Promise implementation.
Object.defineProperty(Fortune, 'Promise', {
  enumerable: true,
  get: function () {
    return promise.Promise
  },
  set: function (x) {
    promise.Promise = x
  }
})


// Use Bluebird as default Promise implementation for Node.js.
Fortune.Promise = Promise


// Assign useful static properties to the default export.
assign(Fortune, {
  adapters: adapters,
  serializers: serializers,
  net: net
})


module.exports = Fortune
