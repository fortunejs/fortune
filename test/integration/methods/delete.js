import { fail, run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'
import * as methods from '../../../lib/common/methods'
import change from '../../../lib/common/change'


run(() => {
  comment('delete record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(change, data => {
      ok(arrayProxy.find(data[methods.delete].user, id => id === 3),
        'change event shows deleted ID')
      deepEqual(data[methods.update].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: methods.delete,
      ids: [ 3 ]
    })
  })

  .then(response => {
    equal(response.payload.length, 1, 'records deleted')

    return store.request({
      type: 'user',
      method: methods.find,
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    deepEqual(response.payload.map(record =>
      arrayProxy.find(record.friends, id => id === 3)),
      [ undefined, undefined ], 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
})
