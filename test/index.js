'use strict'

var chalk = require('chalk')
var tapdance = require('tapdance')
var comment = tapdance.comment
var run = tapdance.run
var start = Date.now()

// Unit tests.
require('./unit/record_type')
require('./unit/serializer')

// Integration tests.
require('./integration/methods/find')
require('./integration/methods/create')
require('./integration/methods/update')
require('./integration/methods/delete')
require('./integration/serializers/json')
require('./integration/serializers/form')
require('./integration/adapters/memory')
require('./integration/http')
require('./integration/websocket')

run(function () {
  comment(chalk.yellow('Test finished in ' +
    chalk.bold(Date.now() - start) + ' ms!'))
})
