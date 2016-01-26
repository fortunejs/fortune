'use strict'

var msgpack = require('msgpack-lite')
var promise = require('../common/promise')
var common = require('../adapter/adapters/common')
var generateId = common.generateId


/**
 * Given a WebSocket client, send a request using the Fortune wire protocol,
 * and get a response back as a Promise. This will not create a client, it
 * needs to be created externally. For example:
 *
 * ```js
 * // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 * var client = new WebSocket(url, protocols)
 * ```
 *
 * The `data` object may contain the keys `id` (if it is not provided, it will
 * be generated), and either `state` or `request`.
 *
 * @param {WebSocket} client
 * @param {Object} data
 * @return {Promise}
 */
function request (client, data) {
  var Promise = promise.Promise, id

  if (typeof data !== 'object')
    return Promise.reject(new TypeError('Data must be an object.'))

  if (!('id' in data)) data.id = generateId()
  id = data.id

  return new Promise(function (resolve, reject) {
    client.send(msgpack.encode(data).buffer)

    client.addEventListener('message', listener)

    function listener (event) {
      var data = msgpack.decode(event.data)

      // Ignore other responses.
      if (data.id !== id) return null

      client.removeEventListener(listener)

      return 'error' in data ?
        reject(new Error(data.error || 'No error specified.')) :
        resolve(data)
    }
  })
}

module.exports = request
