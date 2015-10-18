import WebSocket from 'ws'
import Fortune from '../'

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
export default function websocket (instance, options, change) {
  if (!(instance instanceof Fortune))
    throw new Error('An instance of Fortune is required.')

  if (typeof change === 'undefined')
    change = (socket, event) => JSON.stringify(event)

  const server = new WebSocket.Server(options)

  server.on('connection', socket => {
    socket.on('close', () =>
      instance.removeListener(changeEvent, changeHandler))
    instance.on(changeEvent, changeHandler)

    function changeHandler (event) {
      Promise.resolve(change(socket, event))
      .then(result => result ? socket.send(result) : null)
    }
  })

  return server
}
