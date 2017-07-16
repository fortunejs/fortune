'use strict'

const run = require('tapdance')

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const deepEqual = require('../../../lib/common/deep_equal')

const constants = require('../../../lib/common/constants')
const primaryKey = constants.primary


run((assert, comment) => {
  let callCount = 0

  comment('one find is one method call')

  return testInstance()
  .then(store => {
    store.adapter.find = () => {
      callCount++
      return Promise.resolve([])
    }
    return store.find('user')
  })
  .then(result => {
    assert(callCount === 1, 'find called once')
  })
})


run((assert, comment) => {
  comment('get collection')
  return findTest({
    request: [ 'user' ],
    response: response => {
      assert(response.payload.records.length === 3, 'gets all records')
    }
  })
})


run((assert, comment) => {
  comment('get IDs')
  return findTest({
    request: [ 'user', [ 2, 1 ] ],
    response: response => {
      assert(deepEqual(response.payload.records
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ]), 'gets records with IDs')
    }
  })
})


run((assert, comment) => {
  comment('get includes')
  return findTest({
    request: [ 'user', [ 1, 2 ], null, 'ownedPets' ],
    response: response => {
      assert(deepEqual(response.payload.records
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ]), 'gets records with IDs')
      assert(deepEqual(response.payload.include.animal
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'gets included records')
    }
  })
})


run((assert, comment) => {
  comment('get deep includes')
  return findTest({
    request: [ 'user', [ 1 ], null, [ 'spouse', 'enemies' ] ],
    response: response => {
      assert(deepEqual(response.payload.records
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1 ]), 'gets records with IDs')
      assert(deepEqual(response.payload.include.user
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 3 ]), 'gets included records')
    }
  })
})


run((assert, comment) => {
  comment('get includes with options')
  return findTest({
    request: [ 'user', 1, null, [
      'spouse', [ 'enemies', { fields: { name: true } } ]
    ] ],
    response: response => {
      assert(response.payload.include.user.length === 1,
        'number of records found is correct')
      assert(response.payload.include.user
        .every(record => Object.keys(record).length === 3),
        'fields option applied')
    }
  })
})


function findTest (o) {
  let store

  return testInstance()

  .then(instance => {
    store = instance
    return store.find.apply(store, o.request)
  })

  .then(response => {
    o.response(response)
    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    throw error
  })
}
