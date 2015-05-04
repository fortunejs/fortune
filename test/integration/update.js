import Test from 'tape'
import Serializer from '../../lib/serializer'
import generateApp from './generate_app'
import * as stderr from '../stderr'
import * as arrayProxy from '../../lib/common/array_proxy'


Test('update one to one with 2nd degree unset', updateTest.bind({
  plan: 4,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [{
    id: 3,
    set: { spouse: 2 }
  }],
  relatedType: 'user',
  related: function (t, response) {
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
  }
}))


Test('update one to one with former related record', updateTest.bind({
  plan: 4,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [{
    id: 2,
    set: { spouse: 3 }
  }],
  relatedType: 'user',
  related: function (t, response) {
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
  }
}))


Test('update one to one with same value', updateTest.bind({
  plan: 3,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [{
    id: 2,
    set: { spouse: 1 }
  }],
  relatedType: 'user',
  related: function (t, response) {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, 2,
      'related field is same')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 1,
      'field is same')
    t.end()
  }
}))


Test('update one to many (set)', updateTest.bind({
  plan: 4,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].animal,
      [1], 'change event shows updated IDs')
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [{
    id: 1,
    set: { owner: 2 }
  }],
  relatedType: 'user',
  related: function (t, response) {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).pets.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'related field pushed')
    t.end()
  }
}))


Test('update one to many (unset)', updateTest.bind({
  plan: 3,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].animal,
      [1], 'change event shows updated IDs')
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [1], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [{
    id: 1,
    set: { owner: null }
  }],
  relatedType: 'user',
  related: function (t, response) {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
    t.end()
  }
}))


Test('update many to one (pull)', updateTest.bind({
  plan: 4,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user,
      [2], 'change event shows updated IDs')
    t.deepEqual(data[events.update].animal,
      [ 2, 3 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [{
    id: 2,
    pull: { pets: [ 2, 3 ] }
  }],
  relatedType: 'animal',
  related: function (t, response) {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).owner, null,
      'related field set')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).owner, null,
      'related field set')
    t.end()
  }
}))


Test('update many to one (push)', updateTest.bind({
  plan: 3,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user,
      [2], 'change event shows updated IDs')
    t.deepEqual(data[events.update].animal,
      [1], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [{
    id: 2,
    push: { pets: 1 }
  }],
  relatedType: 'animal',
  related: function (t, response) {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).owner, 2,
      'related field set')
    t.end()
  }
}))


Test('update many to many (pull)', updateTest.bind({
  plan: 2,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [{
    id: 3,
    pull: { friends: 2 }
  }],
  relatedType: 'user',
  related: function (t, response) {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends, [],
      'related ID pulled')
    t.end()
  }
}))


Test('update many to many (push)', updateTest.bind({
  plan: 2,
  change: function (t, events, data) {
    t.deepEqual(data[events.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [{
    id: 1,
    push: { friends: 2 }
  }],
  relatedType: 'user',
  related: function (t, response) {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends.sort((a, b) => a - b),
      [ 1, 3 ], 'related ID pushed')
    t.end()
  }
}))


function updateTest (t) {
  let app, events

  class DefaultSerializer extends Serializer {}
  DefaultSerializer.id = Symbol()

  t.plan(this.plan)

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a
    ;({ events } = app.dispatcher)

    app.dispatcher.on(events.change, this.change.bind(this, t, events))

    return app.dispatcher.request({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      type: this.type,
      method: events.update,
      payload: this.payload
    })
  })

  .then(() => app.dispatcher.request({
    serializerOutput: DefaultSerializer.id,
    type: this.relatedType,
    method: events.find
  }))

  .then(this.related.bind(this, t))

  .catch(error => {
    stderr.error(error)
    t.fail(error)
  })
}
