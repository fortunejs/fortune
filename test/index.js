'use strict'

var tapdance = require('tapdance')

// Unit tests.
require('./unit/record_type')

// Integration tests.
require('./integration/adapters/memory')
require('./integration/methods/find')
require('./integration/methods/create')
require('./integration/methods/update')
require('./integration/methods/delete')
require('./integration/net/http')
require('./integration/net/json')
require('./integration/net/form')
