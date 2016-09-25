'use strict'

var tapdance = require('tapdance')
var ok = tapdance.ok
var pass = tapdance.pass
var fail = tapdance.fail
var comment = tapdance.comment
var run = tapdance.run

var fortune = require('../lib/browser')

require('./integration/adapters/memory')
require('./integration/adapters/indexeddb')

run(function () {
  var timestamp
  var store = fortune({
    model: {
      name: { type: String },
      junk: { type: Object }
    }
  }, {
    adapter: [
      fortune.adapters.indexedDB,
      { name: 'fortune_test' }
    ]
  })

  comment('can run in browser')
  ok(fortune.adapters.indexedDB, 'indexeddb adapter exists')

  return store.connect()
  .then(function (store) {
    ok(store instanceof fortune, 'instantiation works')

    return store.adapter.delete('model')
  })
  .then(function () {
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
  .then(function () {
    ok('can handle concurrent requests')

    return store.request({
      type: 'model',
      ids: [ 'x-1', 'x-2', 'x-3', 'x-4' ]
    })
  })
  .then(function (response) {
    var i, j, k, obj = { junk: {} }

    ok(response.payload.records.length === 4, 'find works')

    for (i = 100; i--;) {
      obj.junk[i] = {}
      for (j = 100; j--;) {
        obj.junk[i][j] = {}
        for (k = 100; k--;)
          obj.junk[i][j][k] = Math.random()
      }
    }

    comment('giant object')
    timestamp = Date.now()

    return store.request({
      type: 'model',
      method: fortune.methods.create,
      payload: [ obj ]
    })
  })
  .then(function () {
    comment('operation took ' + (Date.now() - timestamp) + ' ms')
    pass('giant object stored')
    return store.disconnect()
  })
  .catch(fail)
})
