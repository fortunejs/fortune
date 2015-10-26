import { fail, run, comment, ok, deepEqual, equal } from 'tapdance'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'

var find = require('../../../lib/common/array/find')

var constants = require('../../../lib/common/constants')
var changeEvent = constants.change
var deleteMethod = constants.delete
var updateMethod = constants.update


run(() => {
  comment('delete record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      ok(find(data[deleteMethod].user, id => id === 3),
        'change event shows deleted ID')
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: deleteMethod,
      ids: [ 3 ]
    })
  })

  .then(response => {
    equal(response.payload.length, 1, 'records deleted')

    return store.request({
      type: 'user',
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    deepEqual(response.payload.map(record =>
      find(record.friends, id => id === 3)),
      [ undefined, undefined ], 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
})
