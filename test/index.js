'use strict'

// Set the Promise implementation for testing.
require('../lib/common/promise').Promise = require('bluebird')

// Unit tests.
require('./unit/record_type')

// Integration tests.
require('./integration/adapters/memory')
require('./integration/methods/find')
require('./integration/methods/create')
require('./integration/methods/update')
require('./integration/methods/delete')
