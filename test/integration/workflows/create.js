import Test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


Test('create record', t => {
  let app, events

  t.plan(7)

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a
    ;({ events } = app.dispatcher)

    app.dispatcher.on(events.change, data => {
      t.ok(arrayProxy.find(data[events.create].user, id => id === 4),
        'change event shows created ID')
      t.deepEqual(data[events.update].user.sort((a, b) => a - b),
        [ 1, 3 ], 'change event shows updated IDs')
    })

    return app.dispatcher.request({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.create,
      payload: [{
        id: 4,
        name: 'Slimer McGee',
        birthday: new Date(2011, 5, 30),
        friends: [ 1, 3 ]
      }]
    })
  })

  .then(response => {
    t.equal(response.payload.records.length, 1, 'record created')
    t.equal(response.payload.records[0].id, 4, 'record has correct ID')
    t.ok(response.payload.records[0].birthday instanceof Date,
      'field has correct type')
    t.equal(response.payload.records[0].name, 'Slimer McGee',
      'record has correct field value')

    return app.dispatcher.request({
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.find,
      ids: [ 1, 3 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.records.map(record =>
      arrayProxy.find(record.friends, id => id === 4)),
      [ 4, 4 ], 'related records updated')

    return app.close().then(() => t.end())
  })

  .catch(error => {
    stderr.error(error)
    t.fail(error)
  })
})
