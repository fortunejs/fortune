'use strict'

var msgpack = require('msgpack-lite')
var WebSocket = require('ws')
var Server = WebSocket.Server
var promise = require('../common/promise')
var assign = require('../common/assign')
var constants = require('../common/constants')
var changeEvent = constants.change

var sendOptions = { binary: true, mask: true }


/**
 * This function returns a WebSocket server that implements the Fortune wire
 * protocol. The options are the same as those documented in the [`ws`
 * documentation](https://github.com/websockets/ws/blob/master/doc/ws.md).
 *
 * The wire protocol is based on [MessagePack](http://msgpack.org). The client
 * may send two kinds of requests: setting state within the connection, and
 * making a request to the Fortune instance. Each client request **MUST**
 * include an ID for correlating a response to a request. For example,
 * requesting a state change would look like:
 *
 * ```js
 * { id: 'xxx', state: { ... } } // MessagePack encoded.
 * ```
 *
 * The format is identical in the response for a state change.
 *
 * Making a request to the instance is similar, and has the same parameters as
 * the [`request` method](#fortune-request):
 *
 * ```js
 * { id: 'xxx', request: { ... } } // MessagePack encoded.
 * ```
 *
 * When a request succeeds, the client receives the response like so:
 *
 * ```js
 * { id: 'xxx', response: { ... } } // MessagePack encoded.
 * ```
 *
 * The `change` callback function gets invoked either when a change occurs
 * within the Fortune instance, or when the client requests a state change. If
 * it's an internal change, it is invoked with the current state and changes,
 * otherwise if it's a connection state change, it does not have a second
 * argument. For an internal change, the return value of this function
 * determines either what gets sent to the client, which may be falsy to send
 * nothing. For connection state change, the return value should be what gets
 * assigned over the current state. It may also return a Promise. For example:
 *
 * ```js
 * function change (state, changes) {
 *   return new Promise((resolve, reject) => {
 *     if (!changes) {
 *       // Accept only changes to the `isListening` key.
 *       return resolve({ isListening: Boolean(state.isListening) })
 *     }
 *     // Determine what changes should be relayed to the client,
 *     // based on the current state.
 *     return resolve(state.isListening ? changes : null)
 *   })
 * }
 * ```
 *
 * The changes are relayed to the client like so:
 *
 * ```js
 * { changes: { ... } } // MessagePack encoded.
 * ```
 *
 * If any request fails, the client receives a message like so:
 *
 * ```js
 * { id: 'xxx', error: '...' } // MessagePack encoded.
 * ```
 *
 * @param {Fortune} instance
 * @param {Function} [change]
 * @param {Object} [options]
 * @param {Function} [callback]
 * @return {Server}
 */
function ws (instance, change, options, callback) {
  var Promise = promise.Promise
  var server = new Server(options, callback)

  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  // Default change function is not very useful.
  if (change == null)
    change = function (state, changes) {
      return changes ? changes : state
    }

  server.on('connection', function (socket) {
    // Store connection state in this closure.
    var currentState = {}

    socket.on('message', function (data, flags) {
      // Message must be binary and masked, otherwise ignore.
      if (!flags.binary || !flags.masked) return null

      data = msgpack.decode(data)

      if (!('id' in data))
        return sendError('Correlation ID is missing.')

      if ((!('state' in data) && !('request' in data)) ||
        ('state' in data && 'request' in data))
        return sendError('Invalid request payload.', data.id)

      if ('state' in data)
        return Promise.resolve(change(data.state))
        .then(function (state) {
          assign(currentState, state)
          socket.send(msgpack.encode({
            id: data.id, state: state
          }), sendOptions)
        }, function (error) {
          sendError(error, data.id)
        })

      if ('request' in data)
        return instance.request(data.request)
        .then(function (response) {
          socket.send(msgpack.encode({
            id: data.id, response: response
          }), sendOptions)
        }, function (error) {
          sendError(error, data.id)
        })
    })

    instance.on(changeEvent, function (changes) {
      return Promise.resolve(change(currentState, changes))
      .then(function (changes) {
        socket.send(msgpack.encode({ changes: changes }), sendOptions)
      }, sendError)
    })

    function sendError (error, id) {
      var data = { error: error.toString() }
      if (id !== void 0) data.id = id
      socket.send(msgpack.encode(data), sendOptions)
    }
  })
}

module.exports = ws
