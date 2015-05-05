import Test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


Test('delete record', t => {
  let app, events

  t.plan(4)

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a
    ;({ events } = app.dispatcher)

    app.dispatcher.on(events.change, data => {
      t.ok(arrayProxy.find(data[events.delete].user, id => id === 3),
        'change event shows deleted ID')
      t.deepEqual(data[events.update].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return app.dispatch({
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.delete,
      ids: [3]
    })
  })

  .then(response => {
    t.ok(!response.payload.records.length, 'records deleted')

    return app.dispatch({
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.find,
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.records.map(record =>
      arrayProxy.find(record.friends, id => id === 3)),
      [ undefined, undefined ], 'related records updated')

    return app.stop()
  })

  .then(() => t.end())

  .catch(error => {
    stderr.error(error)
    t.fail(error)
  })
})
