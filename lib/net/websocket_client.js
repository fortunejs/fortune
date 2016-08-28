'use strict'

var core = require('../core')
var wsRequest = require('./websocket_request')


/**
 * Given a W3C WebSocket client, return an object that contains Fortune
 * instance methods `request`, `find`, `create`, `update`, `delete`, and a new
 * method `state` for changing connection state. This is merely a convenience
 * method that wraps around `fortune.net.request`. For example:
 *
 * ```js
 * // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 * var client = new WebSocket(url, protocols)
 * var remote = fortune.net.client(client)
 *
 * // `remote` is an object containing Fortune instance methods, and the
 * // `state` method.
 * remote.request(...)
 * remote.state(...)
 * ```
 *
 * @param {WebSocket} client
 * @return {Object}
 */
function client (client) {
  // Using the closure here to refer to the client.
  return {
    request: function request (options) {
      return wsRequest(client, options)
    },
    state: function state (state) {
      return wsRequest(client, null, state)
    },
    find: core.prototype.find,
    create: core.prototype.create,
    update: core.prototype.update,
    delete: core.prototype.delete
  }
}

module.exports = client
