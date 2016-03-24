'use strict'

const tapdance = require('tapdance')
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const deepEqual = require('../../../lib/common/deep_equal')

const constants = require('../../../lib/common/constants')
const primaryKey = constants.primary


run(() => {
  comment('get collection')
  return findTest({
    request: {
      type: 'user'
    },
    response: response => {
      ok(response.payload.records.length === 3, 'gets all records')
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
      ok(deepEqual(response.payload.records
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ]), 'gets records with IDs')
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
      ok(deepEqual(response.payload.records
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2 ]), 'gets records with IDs')
      ok(deepEqual(response.payload.include.animal
        .map(record => record[primaryKey]).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'gets included records')
    }
  })
})


run(() => {
  comment('get includes with options')
  return findTest({
    request: {
      type: 'user',
      ids: [ 1 ],
      include: [ [ 'spouse', 'enemies', { fields: { name: true } } ] ]
    },
    response: response => {
      ok(response.payload.include.user.length === 1,
        'number of records found is correct')
      ok(response.payload.include.user
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
