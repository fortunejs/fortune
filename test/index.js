'use strict'

var Promise = require('bluebird')
var tapdance = require('tapdance')

// Set Promise implementation to Bluebird.
tapdance.Promise = Promise

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
