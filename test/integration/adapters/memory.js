var deepEqual = require('deep-equal')
var tapdance = require('tapdance')
var ok = tapdance.ok
var fail = tapdance.fail
var comment = tapdance.comment
var run = tapdance.run

var testAdapter = require('../../unit/adapter')
var memoryAdapter = require('../../../lib/adapter/adapters/memory')
var Adapter = require('../../../lib/adapter')
var keys = require('../../../lib/common/keys')
var errors = require('../../../lib/common/errors')
var map = require('../../../lib/common/array/map')

var promise = require('../../../lib/common/promise')
var Promise = promise.Promise

var recordTypes = {
  type: {
    int: { type: Integer }
  }
}

var MemoryAdapter = memoryAdapter(Adapter)
var adapter = new MemoryAdapter({
  keys: keys,
  errors: errors,
  recordTypes: recordTypes,
  transforms: {},
  Promise: Promise
})

testAdapter(memoryAdapter)

run(function () {
  comment('custom types')
  return adapter.connect()
  .then(() => adapter.create('type', [
    { int: 1 }, { int: 2 }
  ]))
  .then(records => {
    ok(records.length === 2, 'records created')
    return adapter.find('type', null, { sort: { int: false } })
  })
  .then(records => {
    ok(deepEqual([ 2, 1 ], map(records, function (record) {
      return record.int
    })), 'compare function is applied')
    return adapter.find('type', null, { match: { int: -1 } })
  })
  .then(records => {
    ok(records.length, 'equal function is applied')
  })
  .catch(error => {
    throw error
  })
})


function Integer (x) { return (x | 0) === x }

Integer.compare = function (a, b) { return a - b }

// For the sake of testing, this is intentionally wrong.
Integer.equal = function (a, b) { return a === -b }
