import './integration/adapters/indexeddb'
import './integration/adapters/webstorage'

import { comment, fail, end, run } from 'tapdance'
import fortune from '../lib/browser'
import { ok } from './helpers'


run(() => {
  comment('can run in browser')

  ok('IndexedDB' in fortune.adapters, 'indexeddb adapter exists')
  ok('WebStorage' in fortune.adapters, 'web storage adapter exists')

  const store = fortune.create()

  store.connect()
  .then(store => {
    ok(store instanceof fortune, 'instantiation works')
    return store.disconnect()
  })
  .then(() => end())
  .catch(error => fail(error))
})
