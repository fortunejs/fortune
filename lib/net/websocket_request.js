'use strict'

var msgpack = require('msgpack-lite')
var promise = require('../common/promise')
var common = require('../adapter/adapters/common')
var generateId = common.generateId


/**
 * Given a W3C WebSocket client, send a request using the Fortune wire
 * protocol, and get a response back as a Promise. This will not create a
 * client, it needs to be created externally. For example:
 *
 * ```js
 * // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 * var client = new WebSocket(url, protocols)
 * client.addEventListener('open', function () {
 *   fortune.net.request(client, { ... })
 * })
 * ```
 *
 * The `options` object is exactly the same as that defined by
 * `fortune.request`, and the `state` object is an arbitrary object to send
 * to request a state change. Either `options` or `state` must be passed.
 *
 * @param {WebSocket} client
 * @param {Object} [options]
 * @param {Object} [state]
 * @return {Promise}
 */
function request (client, options, state) {
  var Promise = promise.Promise
  var id = generateId()
  var data = { id: id }

  if (options && state) throw new Error('Must specify only options or state.')
  else if (options) data.request = options
  else if (state) data.state = state
  else throw new Error('Missing argument options or state.')

  return new Promise(function (resolve, reject) {
    client.binaryType = 'arraybuffer'
    client.addEventListener('message', listener)
    client.send(msgpack.encode(data))

    function listener (event) {
      var data

      if ('decoded' in event) data = event.decoded
      else try {
        data = event.decoded = msgpack.decode(new Uint8Array(event.data))
      }
      catch (error) {
        return reject(error)
      }

      // Ignore other responses.
      if (data.id !== id) return null

      client.removeEventListener('message', listener)

      return 'error' in data ?
        reject(new Error(data.error || 'No error specified.')) :
        resolve(data)
    }
  })
}

module.exports = request
