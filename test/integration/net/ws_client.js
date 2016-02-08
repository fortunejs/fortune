'use strict'

const tapdance = require('tapdance')
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok
const pass = tapdance.pass
const fail = tapdance.fail
const fortune = require('../../../lib')
const testInstance = require('../test_instance')


run(() => {
  comment('fortune wire protocol')

  const port = 8890
  let store, client

  return testInstance({ settings: { enforceLinks: false } })
  .then(instance => {
    store = instance
    client = new WebSocket(`ws://localhost:${port}`)
    fortune.net.sync(client, store)

    return new Promise((resolve, reject) => {
      client.addEventListener('open', resolve)
      client.addEventListener('error', reject)
    })
  })
  .then(() => fortune.net.request(client, { state: { foo: 'bar' } }))
  .then(result => {
    ok(result.state.foo === 'bar', 'connection state is set')
    return fortune.net.request(client, { request: { type: 'user' } })
  })
  .then(result => {
    ok(result.response.payload.records.length === 3, 'records fetched')

    return Promise.all([
      new Promise(resolve => {
        store.once('sync', changes => {
          ok(changes.create.user.length === 1, 'records synced')
          return resolve(changes)
        })
      }),
      fortune.net.request(client, {
        request: { type: 'user', method: 'create', payload: [ {} ] }
      })
    ])
  })
  .then(results => {
    ok(results[1].response.payload.records.length === 1, 'record created')
    return fortune.net.request(client, { x: 'y' })
  })
  .then(() => fail('should have failed'), () => pass('error occurs'))
  .then(() => fortune.net.request(client, { state: { kill: true } }))
})
