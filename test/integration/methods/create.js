'use strict'

const tapdance = require('tapdance')
const pass = tapdance.pass
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const find = require('../../../lib/common/array/find')
const deepEqual = require('../../../lib/common/deep_equal')

const constants = require('../../../lib/common/constants')
const changeEvent = constants.change
const createMethod = constants.create
const updateMethod = constants.update
const primaryKey = constants.primary

const errors = require('../../../lib/common/errors')
const ConflictError = errors.ConflictError

const deadcode = new Buffer('deadc0de', 'hex')

const records = [
  {
    [primaryKey]: 4,
    name: 'Slimer McGee',
    birthday: new Date(2011, 5, 30),
    friends: [ 1, 3 ],
    picture: deadcode
  }
]


run(() => {
  comment('create record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      ok(deepEqual(data[createMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 4 ]), 'change event shows created IDs')
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 3 ]), 'change event shows updated IDs')
    })

    return store.create('user', records)
  })

  .then(response => {
    const results = response.payload.records
    ok(deadcode.equals(results[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    ok(results[0].createdAt !== null, 'input hook applied')
    ok(results.length === 1, 'record created')
    ok(results[0][primaryKey] === 4, 'record has correct ID')
    ok(results[0].birthday instanceof Date,
      'field has correct type')
    ok(results[0].name === 'Slimer McGee',
      'record has correct field value')

    return store.find('user', [ 1, 3 ])
  })

  .then(response => {
    ok(deepEqual(response.payload.records.map(record =>
      find(record.friends, id => id === 4)),
      [ 4, 4 ]), 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
})


run(() => {
  comment('create records with same to-one relationship should fail')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.create('user', [ { spouse: 2 }, { spouse: 2 } ])
  })

  .then(() => {
    fail('should have failed')
  })
  .catch(error => {
    pass('should reject request')
    ok(error instanceof ConflictError, 'error type is correct')
  })
})


run(() => {
  comment('create records with non-unique array relationship should fail')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.create('user', { friends: [ 2, 2 ] })
  })

  .then(() => {
    fail('should have failed')
  })
  .catch(error => {
    pass('should reject request')
    ok(error instanceof ConflictError, 'error type is correct')
  })
})
