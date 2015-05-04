import Test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


Test('get index', findTest.bind({
  response: function (t, response) {
    t.deepEqual(response.payload.sort(), ['animal', 'user'], 'gets the index')
  }
}))


Test('get collection', findTest.bind({
  request: {
    type: 'user'
  },
  response: function (t, response) {
    t.equal(response.payload.records.length, 3, 'gets all records')
  }
}))


Test('get IDs', findTest.bind({
  request: {
    type: 'user',
    ids: [ 2, 1 ]
  },
  response: function (t, response) {
    t.deepEqual(response.payload.records
      .map(record => record.id).sort((a, b) => a - b),
      [ 1, 2 ], 'gets records with IDs')
  }
}))


Test('get includes', findTest.bind({
  request: {
    type: 'user',
    ids: [1, 2 ],
    include: [['pets']]
  },
  response: function (t, response) {
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

  generateApp({
    serializers: [{ type: DefaultSerializer }]
  })

  .then(a => {
    app = a

    return app.dispatcher.request(Object.assign({
      serializerOutput: DefaultSerializer.id
    }, this.request))
  })

  .then(response => {
    this.response.call(this, t, response)

    return app.stop().then(() => t.end())
  })

  .catch(error => {
    stderr.error(error)
    t.fail(error)
  })
}
