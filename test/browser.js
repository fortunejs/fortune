'use strict'

var Promise = require('bluebird')
var tapdance = require('tapdance')
var ok = tapdance.ok
var fail = tapdance.fail
var comment = tapdance.comment
var run = tapdance.run

var fortune = require('../lib/browser')

tapdance.Promise = fortune.Promise = Promise
tapdance.isConcurrent = false

require('./integration/adapters/memory')
require('./integration/adapters/indexeddb')
require('./integration/adapters/webstorage')

run(function () {
  var store = fortune()

  comment('can run in browser')
  ok(fortune.adapters.indexedDB, 'indexeddb adapter exists')
  ok(fortune.adapters.webStorage, 'web storage adapter exists')

  return store.connect()
  .then(function (store) {
    ok(store instanceof fortune, 'instantiation works')
    return store.disconnect()
  })
  .catch(fail)
})
