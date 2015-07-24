import WebSocket from 'ws'
import Fortune from '../'
import change from '../common/change'


const inParens = /\(([^\)]+)\)/


/**
 * This function returns a WebSocket server, which internally uses the `ws`
 * module. The options are the same as those listed
 * [here](https://einaros.github.io/ws/). The handlers are as follows:
 *
 * ```js
 * {
 *   // Executed once on a new connection.
 *   connection: () => null,
 *
 *   // Executed on receiving a message.
 *   message: (data, flags) => null,
 *
 *   // Executed on a change event, it may return a Promise which resolves
 *   // to a payload to sent over the wire, or a falsy value to omit sending.
 *   change: event => null
 *
 *   // Executed when a connection is closed.
 *   close: () => null,
 * }
 * ```
 *
 * Handler functions are called with a unique context (`this`) for each
 * connection.
 *
 * @param {Fortune} instance
 * @param {Object} options
 * @param {Object} [handlers]
 * @return {WebSocket.Server}
 */
export default function websocket (instance, options, handlers = {}) {
  if (!(instance instanceof Fortune))
    throw new Error('An instance of Fortune is required.')

  if (!('connection' in handlers)) handlers.connection = () => null
  if (!('close' in handlers)) handlers.close = () => null
  if (!('message' in handlers)) handlers.message = () => null
  if (!('change' in handlers))
    handlers.change = event => JSON.stringify(
      Object.getOwnPropertySymbols(event)
      .reduce((object, symbol) => {
        const description = (symbol.toString().match(inParens) || [])[1]
        if (description) object[description] = event[symbol]
        return object
      }, {}))

  const server = new WebSocket.Server(options)

  server.on('connection', socket => {
    const context = {}

    socket.on('message', handlers.message.bind(context))

    socket.on('close', () => {
      instance.removeListener(change, changeHandler)
      handlers.close.call(context)
    })

    instance.on(change, changeHandler)

    handlers.connection.call(context)

    function changeHandler (event) {
      Promise.resolve(handlers.change.call(context, event))
      .then(result => result ? socket.send(result) : null)
    }
  })

  return server
}
