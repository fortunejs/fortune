'use strict'

var Promise = require('bluebird')
var tapdance = require('tapdance')

// Set Promise implementation to Bluebird.
tapdance.Promise = Promise

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
