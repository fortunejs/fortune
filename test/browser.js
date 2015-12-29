'use strict'

var Promise = require('bluebird')
var tapdance = require('tapdance')
var ok = tapdance.ok
var fail = tapdance.fail
var comment = tapdance.comment
var run = tapdance.run

var fortune = require('../lib/browser')

tapdance.Promise = fortune.Promise = Promise

require('./integration/adapters/memory')
require('./integration/adapters/indexeddb')

run(function () {
  var store = fortune({
    adapter: { type: fortune.adapters.indexedDB }
  })

  comment('can run in browser')
  ok(fortune.adapters.indexedDB, 'indexeddb adapter exists')

  store.defineType('model', {
    name: { type: String }
  })

  return store.connect()
  .then(function (store) {
    ok(store instanceof fortune, 'instantiation works')
    return Promise.all([
      store.request({
        type: 'model',
        method: fortune.methods.create,
        payload: [
          { id: 'x-1', name: 'foo' },
          { id: 'x-2', name: 'bar' }
        ]
      }),
      store.request({
        type: 'model',
        method: fortune.methods.create,
        payload: [
          { id: 'x-3', name: 'baz' },
          { id: 'x-4', name: 'qux' }
        ]
      })
    ])
  })
  .then(() => {
    ok('can handle concurrent requests')

    return store.request({
      type: 'model',
      ids: [ 'x-1', 'x-2', 'x-3', 'x-4' ]
    })
  })
  .then(response => {
    ok(response.payload.length === 4, 'find works')
    return store.disconnect()
  })
  .catch(fail)
})
