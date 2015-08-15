import { fail, run, comment } from 'tapdance'
import { deepEqual } from '../helpers'
import fortune from '../../lib'
import WebSocket from 'ws'


const { methods } = fortune
const store = fortune.create()
const port = 2048
const server = fortune.net.websocket(store, { port })


store.defineType('user', {
  name: { type: String }
})


run(() => {
  comment('websocket module')
  return store.connect()
  .then(() => new Promise(resolve => {
    const connection = new WebSocket(`ws://localhost:${port}`)

    connection.on('open', () => {
      store.request({
        method: methods.create,
        type: 'user',
        payload: [ {
          id: 1,
          name: 'foobar'
        } ]
      })
    })

    connection.on('message', data => {
      const json = JSON.parse(data)
      deepEqual(json, { create: { user: [ 1 ] } }, 'data looks correct')
      server.close()
      store.disconnect()
      resolve()
    })
  }))
  .catch(error => fail(error))
})
