import test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()

const deadcode = new Buffer(4)
deadcode.writeUInt32BE(0xdeadc0de, 0)

const records = [
  {
    id: 4,
    name: 'Slimer McGee',
    birthday: new Date(2011, 5, 30),
    friends: [ 1, 3 ],
    picture: deadcode
  }
]


test('create record', t => {
  let app
  let methods
  let change

  t.plan(8)

  generateApp(t, {
    serializers: [ { type: DefaultSerializer } ]
  })

  .then(a => {
    app = a
    ; ({ methods, change } = app.dispatcher)

    app.dispatcher.on(change, data => {
      t.ok(arrayProxy.find(data[methods.create].user, id => id === 4),
        'change event shows created ID')
      t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
        [ 1, 3 ], 'change event shows updated IDs')
    })

    return app.dispatch({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: methods.create,
      payload: records
    })
  })

  .then(response => {
    t.ok(deadcode.equals(response.payload.records[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    t.equal(response.payload.records.length, 1, 'record created')
    t.equal(response.payload.records[0].id, 4, 'record has correct ID')
    t.ok(response.payload.records[0].birthday instanceof Date,
      'field has correct type')
    t.equal(response.payload.records[0].name, 'Slimer McGee',
      'record has correct field value')

    return app.dispatch({
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: methods.find,
      ids: [ 1, 3 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.records.map(record =>
      arrayProxy.find(record.friends, id => id === 4)),
      [ 4, 4 ], 'related records updated')

    return app.stop().then(() => t.end())
  })

  .catch(error => {
    stderr.error.call(t, error)
    app.stop()
    t.fail(error)
    t.end()
  })
})
