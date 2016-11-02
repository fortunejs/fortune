'use strict'

var run = require('tapdance')

var fortune = require('../lib')
var createMethod = fortune.methods.create

require('./integration/adapters/memory')

run(function (assert, comment) {
  var timestamp
  var store = fortune({
    model: {
      name: { type: String },
      junk: { type: Object }
    }
  })

  comment('can run in browser')

  return store.connect()
  .then(function (store) {
    assert(store instanceof fortune, 'instantiation works')
    assert(store.common, 'common dependencies exist')

    return store.adapter.delete('model')
  })
  .then(function () {
    return Promise.all([
      store.request({
        type: 'model',
        method: createMethod,
        payload: [
          { id: 'x-1', name: 'foo' },
          { id: 'x-2', name: 'bar' }
        ]
      }),
      store.request({
        type: 'model',
        method: createMethod,
        payload: [
          { id: 'x-3', name: 'baz' },
          { id: 'x-4', name: 'qux' }
        ]
      })
    ])
  })
  .then(function () {
    assert(true, 'can handle concurrent requests')

    return store.request({
      type: 'model',
      ids: [ 'x-1', 'x-2', 'x-3', 'x-4' ]
    })
  })
  .then(function (response) {
    var i, j, k, obj = { junk: {} }

    assert(response.payload.records.length === 4, 'find works')

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
      method: createMethod,
      payload: [ obj ]
    })
  })
  .then(function () {
    comment('operation took ' + (Date.now() - timestamp) + ' ms')
    assert(true, 'giant object stored')
    return store.disconnect()
  })
})
