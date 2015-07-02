import './integration/adapters/indexeddb'
import test from 'tape'
import fortune from '../lib/browser'


test('can run in browser', t => {
  t.ok('indexeddb' in fortune.adapters, 'indexeddb adapter exists')

  return create()
  .then(store => {
    t.ok(store instanceof fortune, 'instantiation works')
    return store.disconnect()
  })
  .then(() => t.end())
  .catch(error => t.end(error))
})


function create () {
  return new Promise((resolve, reject) => {
    const store = fortune.create()

    store.connect()
    .then(resolve, reject)
  })
}
