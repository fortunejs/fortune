import test from 'tape'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'
import * as keys from '../../../lib/common/keys'
import * as methods from '../../../lib/common/methods'
import change from '../../../lib/common/change'


const deadcode = new Buffer(4)
deadcode.writeUInt32BE(0xdeadc0de, 0)

const records = [
  {
    [keys.primary]: 4,
    name: 'Slimer McGee',
    birthday: new Date(2011, 5, 30),
    friends: [ 1, 3 ],
    picture: deadcode
  }
]


test('create record', t => {
  let store

  t.plan(8)

  testInstance(t, {
    serializers: []
  })

  .then(instance => {
    store = instance

    store.on(change, data => {
      t.ok(arrayProxy.find(data[methods.create].user, id => id === 4),
        'change event shows created ID')
      t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
        [ 1, 3 ], 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: methods.create,
      payload: records
    })
  })

  .then(response => {
    t.ok(deadcode.equals(response.payload[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    t.equal(response.payload.length, 1, 'record created')
    t.equal(response.payload[0][keys.primary], 4, 'record has correct ID')
    t.ok(response.payload[0].birthday instanceof Date,
      'field has correct type')
    t.equal(response.payload[0].name, 'Slimer McGee',
      'record has correct field value')

    return store.request({
      type: 'user',
      method: methods.find,
      ids: [ 1, 3 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.map(record =>
      arrayProxy.find(record.friends, id => id === 4)),
      [ 4, 4 ], 'related records updated')

    return store.disconnect().then(() => t.end())
  })

  .catch(error => {
    stderr.error.call(t, error)
    store.disconnect()
    t.fail(error)
    t.end()
  })
})
