'use strict'

var WebSocket = require('ws')
var Fortune = require('../core')
var promise = require('../common/promise')

var constants = require('../common/constants')
var changeEvent = constants.change


/**
 * This function returns a WebSocket server, which internally uses the `ws`
 * module. The options are the same as those listed
 * [here](https://einaros.github.io/ws/).
 *
 * The change handler function is called with two arguments: the socket
 * instance for each connection, and the change event. It may return a Promise
 * which resolves to the data to send over the wire.
 *
 * @param {Fortune} instance
 * @param {Object} options
 * @param {Function} [change]
 * @return {WebSocket.Server}
 */
function websocket (instance, options, change) {
  var Promise = promise.Promise
  var server

  if (!(instance instanceof Fortune))
    throw new Error('An instance of Fortune is required.')

  if (change === void 0) change =
    function (socket, event) { return JSON.stringify(event) }

  server = new WebSocket.Server(options)

  server.on('connection', function (socket) {
    socket.on('close', function () {
      instance.removeListener(changeEvent, changeHandler)
    })
    instance.on(changeEvent, changeHandler)

    function changeHandler (event) {
      return Promise.resolve(change(socket, event))
      .then(function (result) {
        return result ? socket.send(result) : null
      })
    }
  })

  return server
}


module.exports = websocket
