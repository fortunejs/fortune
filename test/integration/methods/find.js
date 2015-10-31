'use strict'

const tapdance = require('tapdance')
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const equal = tapdance.equal
const deepEqual = tapdance.deepEqual

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const constants = require('../../../lib/common/constants')
const primaryKey = constants.primary


run(() => {
  comment('get index')
  return findTest({
    response: response => {
      deepEqual(response.payload.sort(),
        [ 'animal', 'user', '☯' ], 'gets the index')
    }
  })
})


run(() => {
  comment('get collection')
  return findTest({
    request: {
      type: 'user'
    },
    response: response => {
      equal(response.payload.length, 3, 'gets all records')
    }
  })
})


run(() => {
  comment('get IDs')
  return findTest({
    request: {
      type: 'user',
      ids: [ 2, 1 ]
    },
    response: response => {
      deepEqual(response.payload
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ], 'gets records with IDs')
    }
  })
})


run(() => {
  comment('get includes')
  return findTest({
    request: {
      type: 'user',
      ids: [ 1, 2 ],
      include: [ [ 'ownedPets' ] ]
    },
    response: response => {
      deepEqual(response.payload
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ], 'gets records with IDs')
      deepEqual(response.payload.include.animal
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2, 3 ], 'gets included records')
    }
  })
})


function findTest (o) {
  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.request(o.request)
  })

  .then(response => {
    o.response(response)

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
}
