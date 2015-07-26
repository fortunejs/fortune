import WebSocket from 'ws'
import Fortune from '../'
import changeEvent from '../common/change'


const inParens = /\(([^\)]+)\)/


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
    change = (socket, event) => JSON.stringify(
      Object.getOwnPropertySymbols(event)
      .reduce((object, symbol) => {
        const description = (symbol.toString().match(inParens) || [])[1]
        if (description) object[description] = event[symbol]
        return object
      }, {}))

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
