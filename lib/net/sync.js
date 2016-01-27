'use strict'

var Fortune = require('../core')
var promise = require('../common/promise')
var msgpack = require('msgpack-lite')
var constants = require('../common/constants')
var syncEvent = constants.sync
var failureEvent = constants.failure


/**
 * Given a WebSocket client and an instance of Fortune, try to synchronize
 * records based on the `changes` data pushed from the server. This function
 * does not have a return value.
 *
 * When a sync is completed, it emits the `sync` event with the changes data,
 * or the `failure` event if something failed.
 *
 * @param {WebSocket} client
 * @param {Fortune} instance
 */
function sync (client, instance) {
  var Promise = promise.Promise

  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  client.binaryType = 'arraybuffer'
  client.addEventListener('message', function (event) {
    var data, promises = [], changes, method, type

    try { data = msgpack.decode(event.data) }
    catch (error) {
      console.log('# fff' + event.data.byteLength)
    }

    // Ignore if changes are not present.
    if (!('changes' in data)) return null

    changes = data.changes
    for (method in changes)
      for (type in changes[method])
        promises.push(instance.adapter[method](type, changes[method][type]))

    return Promise.all(promises)
    .then(function () {
      instance.emit(syncEvent, changes)
    }, function (error) {
      instance.emit(failureEvent, error)
    })
  })
}

module.exports = sync
