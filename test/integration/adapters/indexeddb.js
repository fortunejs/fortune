'use strict'

var testAdapter = require('../../unit/adapter')
var indexeddbAdapter = require('../../../lib/adapter/adapters/indexeddb')

testAdapter(indexeddbAdapter, {
  name: 'fortune_test'
})
