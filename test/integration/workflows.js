import Test from 'tape'
import Serializer from '../../lib/serializer'
import generateApp from './generate_app'
import * as arrayProxy from '../../lib/common/array_proxy'


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
      t.ok(arrayProxy.find(data.user[events.create], id => id === 4),
        'change event shows created ID')
      t.deepEqual(data.user[events.update].sort((a, b) => a - b),
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
    t.end()
  })

  .catch(t.fail)
})


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
      t.ok(arrayProxy.find(data.user[events.delete], id => id === 3),
        'change event shows deleted ID')
      t.deepEqual(data.user[events.update].sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return app.dispatcher.request({
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.delete,
      ids: [3]
    })
  })

  .then(response => {
    t.ok(!response.payload.records.length, 'records deleted')

    return app.dispatcher.request({
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
    t.end()
  })

  .catch(t.fail)
})


Test('update one to one with 2nd degree unset', t => {
  let app, events

  t.plan(4)

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a
    ;({ events } = app.dispatcher)

    app.dispatcher.on(events.change, data => {
      t.deepEqual(data.user[events.update].sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    })

    return app.dispatcher.request({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.update,
      payload: [{
        id: 3,
        set: { spouse: 2 }
      }]
    })
  })

  .then(() => app.dispatcher.request({
    serializerOutput: DefaultSerializer.id,
    type: 'user',
    method: events.find
  }))

  .then(response => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, null,
      '2nd degree related field unset')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 3,
      'related field set')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).spouse, 2,
      'field updated')
    t.end()
  })

  .catch(t.fail)
})


Test('update one to one', t => {
  let app, events

  t.plan(4)

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a
    ;({ events } = app.dispatcher)

    app.dispatcher.on(events.change, data => {
      t.deepEqual(data.user[events.update].sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    })

    return app.dispatcher.request({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      type: 'user',
      method: events.update,
      payload: [{
        id: 2,
        set: { spouse: 3 }
      }]
    })
  })

  .then(() => app.dispatcher.request({
    serializerOutput: DefaultSerializer.id,
    type: 'user',
    method: events.find
  }))

  .then(response => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, null,
      'related field unset')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 3,
      'field updated')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).spouse, 2,
      'related field set')
    t.end()
  })

  .catch(t.fail)
})
