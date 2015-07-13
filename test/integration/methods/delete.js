import test from 'tape'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'
import * as methods from '../../../lib/common/methods'
import change from '../../../lib/common/change'


test('delete record', t => {
  let store

  t.plan(4)

  testInstance(t, {
    serializers: []
  })

  .then(instance => {
    store = instance

    store.on(change, data => {
      t.ok(arrayProxy.find(data[methods.delete].user, id => id === 3),
        'change event shows deleted ID')
      t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: methods.delete,
      ids: [ 3 ]
    })
  })

  .then(response => {
    t.equal(response.payload.length, 1, 'records deleted')

    return store.request({
      type: 'user',
      method: methods.find,
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.map(record =>
      arrayProxy.find(record.friends, id => id === 3)),
      [ undefined, undefined ], 'related records updated')

    return store.disconnect()
  })

  .then(() => t.end())

  .catch(error => {
    stderr.error.call(t, error)
    store.disconnect()
    t.fail(error)
    t.end()
  })
})
