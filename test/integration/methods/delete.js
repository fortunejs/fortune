'use strict'

const tapdance = require('tapdance')
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
const deleteMethod = constants.delete
const updateMethod = constants.update


run(() => {
  comment('delete record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      ok(find(data[deleteMethod].user, id => id === 3),
        'change event shows deleted ID')
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: deleteMethod,
      ids: [ 3 ]
    })
  })

  .then(response => {
    ok(response.payload.records.length === 1, 'records deleted')

    return store.request({
      type: 'user',
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    ok(deepEqual(response.payload.records.map(record =>
      find(record.friends, id => id === 3)),
      [ undefined, undefined ]), 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
})
