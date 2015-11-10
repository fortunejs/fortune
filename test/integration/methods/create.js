'use strict'

const deepEqual = require('deep-equal')
const tapdance = require('tapdance')
const pass = tapdance.pass
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const find = require('../../../lib/common/array/find')

const constants = require('../../../lib/common/constants')
const changeEvent = constants.change
const createMethod = constants.create
const updateMethod = constants.update
const primaryKey = constants.primary


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
      ok(deepEqual(data[createMethod].user.sort((a, b) => a - b),
        [ 4 ]), 'change event shows created IDs')
      ok(deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 3 ]), 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: createMethod,
      payload: records
    })
  })

  .then(response => {
    ok(deadcode.equals(response.payload[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    ok(response.payload[0].createdAt !== null, 'transform applied')
    ok(response.payload.length === 1, 'record created')
    ok(response.payload[0][primaryKey] === 4, 'record has correct ID')
    ok(response.payload[0].birthday instanceof Date,
      'field has correct type')
    ok(response.payload[0].name === 'Slimer McGee',
      'record has correct field value')

    return store.request({
      type: 'user',
      ids: [ 1, 3 ]
    })
  })

  .then(response => {
    ok(deepEqual(response.payload.map(record =>
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

    return store.request({
      type: 'user',
      method: createMethod,
      payload: [ { spouse: 2 }, { spouse: 2 } ]
    })
  })

  .then(() => {
    fail('should have failed')
  })
  .catch(() => {
    pass('should reject request')
  })
})
