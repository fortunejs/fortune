import test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


test('get index', findTest.bind({
  response: (t, response) => {
    t.deepEqual(response.payload.sort(),
      [ 'animal', 'empty', 'user' ], 'gets the index')
  }
}))


test('get collection', findTest.bind({
  request: {
    type: 'user'
  },
  response: (t, response) => {
    t.equal(response.payload.records.length, 3, 'gets all records')
  }
}))


test('get IDs', findTest.bind({
  request: {
    type: 'user',
    ids: [ 2, 1 ]
  },
  response: (t, response) => {
    t.deepEqual(response.payload.records
      .map(record => record.id).sort((a, b) => a - b),
      [ 1, 2 ], 'gets records with IDs')
  }
}))


test('get includes', findTest.bind({
  request: {
    type: 'user',
    ids: [ 1, 2 ],
    include: [ [ 'pets' ] ]
  },
  response: (t, response) => {
    t.deepEqual(response.payload.records
      .map(record => record.id).sort((a, b) => a - b),
      [ 1, 2 ], 'gets records with IDs')
    t.deepEqual(response.payload.include.animal
      .map(record => record.id).sort((a, b) => a - b),
      [ 1, 2, 3 ], 'gets included records')
  }
}))


function findTest (t) {
  let app

  class DefaultSerializer extends Serializer {}
  DefaultSerializer.id = Symbol()

  generateApp(t, {
    serializers: [ { type: DefaultSerializer } ]
  })

  .then(a => {
    app = a

    return app.dispatch(Object.assign({
      serializerOutput: DefaultSerializer.id
    }, this.request))
  })

  .then(response => {
    this.response(t, response)

    return app.stop().then(() => t.end())
  })

  .catch(error => {
    stderr.error.call(t, error)
    app.stop()
    t.fail(error)
    t.end()
  })
}
