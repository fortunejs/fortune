'use strict'

const testAdapter = require('../../unit/adapter')
const indexeddbAdapter = require('../../../lib/adapter/adapters/indexeddb')

testAdapter(indexeddbAdapter, {
  name: 'fortune_test'
})
