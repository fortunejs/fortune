'use strict'

const deepEqual = require('deep-equal')
const tapdance = require('tapdance')
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const DefaultSerializer = require('../../lib/serializer/default')
const errors = require('../../lib/common/errors')

const recordTypes = { foo: {}, bar: {} }
const serializer = new DefaultSerializer({
  errors, recordTypes, transforms: {}
})


run(() => {
  comment('show response: no records')

  const context = { response: {} }

  serializer.showResponse(context)

  ok(deepEqual(context.response.payload, [ 'foo', 'bar' ]), 'types displayed')
})


run(() => {
  comment('show response: records')

  const context = { response: {} }
  const records = [ 1, 2, 3 ]

  serializer.showResponse(context, records)

  ok(deepEqual(context.response.payload, records), 'records displayed')
})


run(() => {
  comment('show response: records with include')

  const context = { response: {} }
  const records = [ 1, 2, 3 ]
  const include = {
    foo: [ 'a', 'b' ]
  }

  serializer.showResponse(context, records, include)

  ok(deepEqual(context.response.payload, records), 'records displayed')
  ok(deepEqual(context.response.payload.include, include), 'include displayed')
})


run(() => {
  comment('show error')

  const context = { response: {} }
  const error = new TypeError('wtf')

  serializer.showError(context, error)

  ok(context.response.payload.name === 'TypeError', 'error name displayed')
  ok(context.response.payload.message === 'wtf', 'error message displayed')
})


run(() => {
  comment('parse create')

  fail(() =>
    serializer.parseCreate({ request: { ids: [] } }),
    'ids can\'t be specified in ids field')
  fail(() =>
    serializer.parseCreate({ request: { payload: null } }),
    'payload can not be empty')
  ok(deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ]), 'return value is correct')
})


run(() => {
  comment('parse update')

  fail(() =>
    serializer.parseCreate({ request: { ids: [] } }),
    'ids can\'t be specified in ids field')
  fail(() =>
    serializer.parseCreate({ request: { payload: null } }),
    'payload can not be empty')
  ok(deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ]), 'return value is correct')
})
