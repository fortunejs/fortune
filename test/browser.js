import './integration/adapters/indexeddb'
import './integration/adapters/webstorage'

import { fail, comment, run } from 'tapdance'
import fortune from '../lib/browser'
import { ok } from './helpers'


run(() => {
  comment('can run in browser')

  ok('indexedDB' in fortune.adapters, 'indexeddb adapter exists')
  ok('webStorage' in fortune.adapters, 'web storage adapter exists')

  const store = fortune.create()

  return store.connect()
  .then(store => {
    ok(store instanceof fortune, 'instantiation works')
    return store.disconnect()
  })
  .catch(error => fail(error))
})
