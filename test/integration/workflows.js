import Test from 'tape'
import Serializer from '../../lib/serializer'
import generateApp from './generate_app'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


Test('get index', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id
}))

.then(response => {
  t.deepEqual(response.payload.sort(), ['animal', 'user'], 'gets the index')
  t.end()
})

.catch(t.fail))


Test('get collection', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id,
  type: 'user'
}))

.then(response => {
  t.equal(response.payload.records.length, 3, 'gets all records')
  t.end()
})

.catch(t.fail))


Test('get IDs', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id,
  type: 'user',
  ids: [ 2, 1 ]
}))

.then(response => {
  t.deepEqual(response.payload.records
    .map(record => record.id).sort((a, b) => a - b),
    [ 1, 2 ], 'gets records with IDs')
  t.end()
})

.catch(t.fail))


Test('create record', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => {
  const { events } = app.dispatcher

  t.plan(4)

  app.dispatcher.on(events.change, data => {
    t.equal(data.user[events.create][0], 4, 'change event shows ID')
  })

  return app.dispatcher.request({
    serializerInput: DefaultSerializer.id,
    serializerOutput: DefaultSerializer.id,
    type: 'user',
    method: events.create,
    payload: [{
      id: 4,
      name: 'Slimer'
    }]
  })
})

.then(response => {
  t.equal(response.payload.records.length, 1, 'record created')
  t.equal(response.payload.records[0].id, 4, 'record has correct ID')
  t.equal(response.payload.records[0].name, 'Slimer',
    'record has correct field value')
  t.end()
})

.catch(t.fail))
