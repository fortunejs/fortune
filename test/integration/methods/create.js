'use strict'

const run = require('tapdance')

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

const buffer = Buffer.from ||
  ((input, encoding) => new Buffer(input, encoding))
const deadcode = buffer('deadc0de', 'hex')

const records = [
  {
    [primaryKey]: 4,
    name: 'Slimer McGee',
    birthday: new Date(2011, 5, 30),
    friends: [ 1, 3 ],
    picture: deadcode
  }
]


run((assert, comment) => {
  comment('create record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      assert(deepEqual(data[createMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 4 ]), 'change event shows created IDs')
      assert(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 3 ]), 'change event shows updated IDs')
    })

    return store.create('user', records)
  })

  .then(response => {
    const results = response.payload.records
    assert(deadcode.equals(results[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    assert(results[0].createdAt !== null, 'input hook applied')
    assert(results.length === 1, 'record created')
    assert(results[0][primaryKey] === 4, 'record has correct ID')
    assert(results[0].birthday instanceof Date,
      'field has correct type')
    assert(results[0].name === 'Slimer McGee',
      'record has correct field value')

    return store.find('user', [ 1, 3 ])
  })

  .then(response => {
    assert(deepEqual(response.payload.records.map(record =>
      find(record.friends, id => id === 4)),
      [ 4, 4 ]), 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    throw error
  })
})


run((assert, comment) => {
  comment('create records with same to-one relationship should fail')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.create('user', [ { spouse: 2 }, { spouse: 2 } ])
  })

  .then(() => {
    assert(false, 'should have failed')
  })
  .catch(error => {
    assert(true, 'should reject request')
    assert(error instanceof ConflictError, 'error type is correct')
  })
})


run((assert, comment) => {
  comment('create records with non-unique array relationship should fail')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.create('user', { friends: [ 2, 2 ] })
  })

  .then(() => {
    assert(false, 'should have failed')
  })
  .catch(error => {
    assert(true, 'should reject request')
    assert(error instanceof ConflictError, 'error type is correct')
  })
})


run((assert, comment) => {
  comment('create record with one-to-one relationship and 2nd degree unset')

  let store
  let didChange

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      didChange = true
      assert(data.update.animal.find(record =>
        record.id === 1 && record.replace.likedBy),
        'should update related record')
      assert(data.update.user.find(record =>
        record.id === 2 && record.replace.likedAnimal === null),
        'should update 2nd degree related record')
    })

    return store.create('user', [ { likedAnimal: 1 } ])
  })

  .then(() => {
    assert(didChange, 'change event emitted')
  })
})


run((assert, comment) => {
  comment('create record with many-to-one relationship and 2nd degree unset')

  let store
  let didChange

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      didChange = true
      assert(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]),
        'should update 2nd degree related records')
    })

    return store.create('user', [ { ownedPets: [ 1, 2, 3 ] } ])
  })

  .then(() => {
    assert(didChange, 'change event emitted')
  })
})
