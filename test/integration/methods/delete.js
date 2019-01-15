'use strict'

const run = require('tapdance')

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const find = require('../../../lib/common/array/find')
const deepEqual = require('../../../lib/common/deep_equal')

const constants = require('../../../lib/common/constants')
const changeEvent = constants.change
const deleteMethod = constants.delete
const updateMethod = constants.update


run((assert, comment) => {
  comment('delete record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      assert(find(data[deleteMethod].user, id => id === 3),
        'change event shows deleted ID')
      assert(find(data[updateMethod].user, update =>
        update.id === 2 && update.pull.enemies[0] === 3),
        'denormalized inverse field is updated')
      assert(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
    })

    return store.delete('user', 3)
  })

  .then(response => {
    assert(response.payload.records.length === 1, 'records deleted')

    return store.find('user', [ 1, 2 ])
  })

  .then(response => {
    assert(deepEqual(response.payload.records.map(record =>
      find(record.friends, id => id === 3)),
      [ undefined, undefined ]), 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    throw error
  })
})
