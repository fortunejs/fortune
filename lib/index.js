'use strict'

var Promise = require('bluebird')

// Local modules.
var Core = require('./core')
var promise = require('./common/promise')
var assign = require('./common/assign')

// Static exports.
var memory = require('./adapter/adapters/memory')

var adapters = {
  memory: memory
}


/**
 * This class just extends Core with some static properties.
 */
function Fortune (recordTypes, options) {
  if (!(this instanceof Fortune)) return new Fortune(recordTypes, options)
  if (options === void 0) options = {}
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
  adapters: adapters
})


module.exports = Fortune
