'use strict'

const deepEqual = require('deep-equal')
const tapdance = require('tapdance')
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const fortune = require('../../lib')
const WebSocket = require('ws')

const methods = fortune.methods
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
      ok(deepEqual(json, { create: { user: [ 1 ] } }), 'data looks correct')
      server.close()
      store.disconnect()
      resolve()
    })
  }))
  .catch(error => fail(error))
})
