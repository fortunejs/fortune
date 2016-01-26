'use strict'

var Fortune = require('../core')
var msgpack = require('msgpack-lite')


/**
 * Given a WebSocket client and an instance of Fortune, try to synchronize
 * records based on the `changes` data pushed from the server. This function
 * does not have a return value.
 *
 * @param {WebSocket} client
 * @param {Fortune} instance
 */
function sync (client, instance) {
  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  client.addEventListener('message', function (event) {
    var data = msgpack.decode(event.data), changes, method, type

    // Ignore if changes are not present.
    if (!('changes' in data)) return null

    changes = data.changes
    for (method in changes)
      for (type in changes[method])
        instance.adapter[method](type, changes[method][type])
  })
}

module.exports = sync
