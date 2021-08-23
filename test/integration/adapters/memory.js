'use strict'

var run = require('tapdance')

var testAdapter = require('../../unit/adapter')
var memoryAdapter = require('../../../lib/adapter/adapters/memory')
var Adapter = require('../../../lib/adapter')
var deepEqual = require('../../../lib/common/deep_equal')
var keys = require('../../../lib/common/keys')
var errors = require('../../../lib/common/errors')
var map = require('../../../lib/common/array/map')

var recordTypes = {
  type: {
    int: { type: Integer },
    foo: { type: Number, isArray: true }
  }
}

var MemoryAdapter = memoryAdapter(Adapter)
var adapter = new MemoryAdapter({
  keys: keys,
  errors: errors,
  recordTypes: recordTypes,
  options: {
    recordsPerType: 20
  }
})

testAdapter(memoryAdapter)

run(function (assert, comment) {
  comment('missing fields')
  return adapter.connect()
  .then(function () {
    adapter.db['type'] = {
      a: { id: 'a', int: 1 }
    }
    return adapter.update('type', [ {
      id: 'a', push: { foo: 1 }
    } ])
  })
  .then(function (count) {
    assert(count === 1, 'count is correct')
    return adapter.find('type')
  })
  .then(function (records) {
    assert(deepEqual(records[0].foo, [ 1 ]), 'pushed value')
  })
})


run(function (assert, comment) {
  comment('custom types')
  return adapter.connect()
  .then(function () { return adapter.create('type', [
    { int: 1 }, { int: 2 }
  ]) })
  .then(function (records) {
    assert(records.length === 2, 'records created')
    return adapter.find('type', null, { sort: { int: false } })
  })
  .then(function (records) {
    assert(deepEqual([ 2, 1 ], map(records, function (record) {
      return record.int
    })), 'compare function is applied')
    return adapter.find('type', null, { match: { int: 1 } })
  })
  .then(function (records) {
    assert(records.length === 1, 'compare function is applied for exact match')
  })
})


run(function (assert, comment) {
  comment('record type mutation')
  return adapter.connect()
  .then(function () {
    recordTypes.type.bar = { type: Number, isArray: true }
    return adapter.create('type', [ { int: 0 } ])
  })
  .then(function (records) {
    assert(records.length === 1, 'records created')
    assert(Array.isArray(records[0].bar), 'new field present')
  })
})


run(function (assert, comment) {
  comment('manual memory management')
  return adapter.connect()
  .then(function () {
    var records = []
    for (var i = 0; i < 100; i++) {
      records.push({ int: i })
    }
    return adapter.create('type', records)
  })
  .then(function (records) {
    assert(records.length === 100, 'records created')
    assert(Object.keys(adapter.db.type).length === 20, 'only max records retained')
  })
})


function Integer (x) { return (x | 0) === x }
Integer.prototype = new Number()
Integer.compare = function (a, b) { return a - b }
