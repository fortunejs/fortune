'use strict'

var Promise = require('bluebird')

// Local modules.
var Core = require('./core')
var promise = require('./common/promise')
var assign = require('./common/assign')
var map = require('./common/array/map')
var defineEnumerable = require('./common/define_enumerable')

// Static exports.
var memory = require('./adapter/adapters/memory')
var json = require('./serializer/serializers/json')
var form = require('./serializer/serializers/form')
var http = require('./net/http')


var adapters = {
  memory: memory
}

var serializers = {
  json: json,
  formUrlEncoded: form.formUrlEncoded,
  formData: form.formData
}

var net = {
  http: http
}


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (options) {
  if (!(this instanceof Fortune)) return new Fortune(options)
  if (options === void 0) options = {}

  if (!('serializers' in options))
    options.serializers = map(Object.keys(serializers), function (name) {
      return { type: serializers[name] }
    })

  this.constructor(options)
}


Fortune.prototype = Object.create(Core.prototype)
assign(Fortune, Core)


Fortune.create = function (options) {
  console.warn('The "Fortune.create" method ' + // eslint-disable-line
    'will be deprecated in future versions.')
  return new Fortune(options)
}


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
defineEnumerable(Fortune, {
  adapters: adapters,
  serializers: serializers,
  net: net
})


module.exports = Fortune
