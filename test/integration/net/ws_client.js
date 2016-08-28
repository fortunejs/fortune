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
  let store, client, remote

  return new Promise(resolve => setTimeout(resolve, 1 * 1000))
  .then(() => testInstance())
  .then(instance => {
    store = instance
    client = new WebSocket(`ws://localhost:${port}`)
    remote = fortune.net.client(client)
    fortune.net.sync(client, store)

    try {
      fortune.net.request(client)
      fail('should have failed')
    }
    catch (error) {
      pass('options or state required')
    }

    return remote.state({ foo: 'bar' })
  })
  .then(result => {
    ok(result.state.foo === 'bar', 'connection state is set')
    return remote.find('user')
  })
  .then(result => {
    ok(result.response.payload.records.length === 3, 'records fetched')
    ok(result.response.payload.count === 3, 'valid count')

    return Promise.all([
      new Promise(resolve => {
        store.once('sync', changes => {
          ok(changes.create.user.length === 1, 'records synced')
          return resolve(changes)
        })
      }),
      remote.create('user', {
        picture: new Buffer('cafebabe', 'hex')
      })
    ])
  })
  .then(results => {
    ok(results[1].response.payload.records.length === 1, 'record created')
  })
  .then(kill, error => {
    kill()
    throw error
  })

  function kill () {
    return remote.state({ kill: true })
  }
})
