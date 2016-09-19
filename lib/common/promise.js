'use strict'

// This object exists as a container for the Promise implementation. By
// default, it's the native one.
exports.Promise = Promise

// Assigning a property for the Promise implementation.
exports.assignPromise = function (obj, key) {
  Object.defineProperty(obj, key, {
    enumerable: true,
    get: function () {
      return exports.Promise
    },
    set: function (x) {
      exports.Promise = x
    }
  })
}
