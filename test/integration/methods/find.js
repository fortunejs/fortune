import test from 'tape'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as keys from '../../../lib/common/keys'


test('get index', findTest.bind({
  response: (t, response) => {
    t.deepEqual(response.payload.sort(),
      [ 'animal', 'user', '☯' ], 'gets the index')
  }
}))


test('get collection', findTest.bind({
  request: {
    type: 'user'
  },
  response: (t, response) => {
    t.equal(response.payload.length, 3, 'gets all records')
  }
}))


test('get IDs', findTest.bind({
  request: {
    type: 'user',
    ids: [ 2, 1 ]
  },
  response: (t, response) => {
    t.deepEqual(response.payload
      .map(record => record[keys.primary]).sort((a, b) => a - b),
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
    t.deepEqual(response.payload
      .map(record => record[keys.primary]).sort((a, b) => a - b),
      [ 1, 2 ], 'gets records with IDs')
    t.deepEqual(response.payload.include.animal
      .map(record => record[keys.primary]).sort((a, b) => a - b),
      [ 1, 2, 3 ], 'gets included records')
  }
}))


function findTest (t) {
  let store

  testInstance(t, {
    serializers: []
  })

  .then(instance => {
    store = instance

    return store.dispatch(this.request)
  })

  .then(response => {
    this.response(t, response)

    return store.disconnect().then(() => t.end())
  })

  .catch(error => {
    stderr.error.call(t, error)
    store.disconnect()
    t.fail(error)
    t.end()
  })
}
