'use strict'

const tapdance = require('tapdance')
const ok = tapdance.ok
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run

const testAdapter = require('../../unit/adapter')
const memoryAdapter = require('../../../lib/adapter/adapters/memory')
const Adapter = require('../../../lib/adapter')
const deepEqual = require('../../../lib/common/deep_equal')
const keys = require('../../../lib/common/keys')
const errors = require('../../../lib/common/errors')
const map = require('../../../lib/common/array/map')

const promise = require('../../../lib/common/promise')
const Promise = promise.Promise

const recordTypes = {
  type: {
    int: { type: Integer }
  }
}

const MemoryAdapter = memoryAdapter(Adapter)
const adapter = new MemoryAdapter({
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
