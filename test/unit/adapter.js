'use strict'

var deepEqual = require('deep-equal')
var tapdance = require('tapdance')
var ok = tapdance.ok
var fail = tapdance.fail
var comment = tapdance.comment
var run = tapdance.run

var Adapter = require('../../lib/adapter')
var errors = require('../../lib/common/errors')
var stderr = require('../stderr')

var message = require('../../lib/common/message')
var promise = require('../../lib/common/promise')
var Promise = promise.Promise

var map = require('../../lib/common/array/map')
var find = require('../../lib/common/array/find')
var includes = require('../../lib/common/array/includes')
var filter = require('../../lib/common/array/filter')

var keys = require('../../lib/common/keys')
var primaryKey = keys.primary

var type = 'user'

var recordTypes = {
  user: {
    name: { type: String },
    age: { type: Number },
    isAlive: { type: Boolean },
    birthday: { type: Date },
    junk: { type: Object },
    picture: { type: Buffer },
    privateKeys: { type: Buffer, isArray: true },
    nicknames: { type: String, isArray: true },
    friends: { link: 'user', isArray: true, inverse: 'friends' },
    nemesis: { link: 'user', inverse: '__user_nemesis_inverse' },
    '__user_nemesis_inverse': { link: 'user', isArray: true,
      inverse: 'nemesis', '__denormalizedInverse': true },
    bestFriend: { link: 'user', inverse: 'bestFriend' }
  }
}

var deadbeef = new Buffer('deadbeef', 'hex')
var key1 = new Buffer('cafe', 'hex')
var key2 = new Buffer('babe', 'hex')

var records = [
  {
    id: 1,
    name: 'bob',
    age: 42,
    isAlive: true,
    junk: { things: [ 'a', 'b', 'c' ] },
    birthday: new Date(),
    friends: [ 2 ],
    bestFriend: 2
  }, {
    id: 2,
    name: 'john',
    age: 36,
    isAlive: false,
    picture: deadbeef,
    privateKeys: [ key1, key2 ],
    friends: [ 1 ],
    bestFriend: 1
  }
]


module.exports = function (adapter, options) {
  function test (fn) { return runTest(adapter, options, fn) }

  run(function () {
    comment('find: nothing')
    return test(function (adapter) {
      return adapter.find(type, [])
      .then(function (records) {
        ok(records.count === 0, 'count is correct')
      })
    })
  })

  run(function () {
    comment('find: id, type checking #1')
    return test(function (adapter) {
      return adapter.find(type, [ 1 ])
      .then(function (records) {
        ok(records.count === 1, 'count is correct')
        ok(records[0][primaryKey] === 1, 'id is correct')
        ok(records[0].birthday instanceof Date,
          'date type is correct')
        ok(typeof records[0].isAlive === 'boolean',
          'boolean type is correct')
        ok(typeof records[0].age === 'number',
          'number type is correct')
        ok(deepEqual(records[0].junk, { things: [ 'a', 'b', 'c' ] }),
          'object value is correct')
        ok(!includes(Object.keys(records[0],
          '__user_nemesis_inverse')), 'denormalized fields not enumerable')
      })
    })
  })

  run(function () {
    comment('find: id, type checking #2')
    return test(function (adapter) {
      return adapter.find(type, [ 2 ])
      .then(function (records) {
        ok(records.count === 1, 'count is correct')
        ok(records[0][primaryKey] === 2, 'id is correct')
        ok(Buffer.isBuffer(records[0].picture),
          'buffer type is correct')
        ok(deadbeef.equals(records[0].picture),
          'buffer value is correct')
        ok(deepEqual(records[0].privateKeys, [ key1, key2 ]),
          'array of buffers is correct')
      })
    })
  })

  run(function () {
    comment('find: collection')
    return test(function (adapter) {
      return adapter.find(type)
      .then(function (records) {
        ok(records.count === 2, 'count is correct')
        testIds(records, 'id type is correct')
      })
    })
  })

  run(function () {
    comment('find: match (string)')
    return test(function (adapter) {
      return adapter.find(type, null,
        { match: { name: [ 'john', 'xyz' ], age: 36 } })
      .then(function (records) {
        ok(records.length === 1, 'match length is correct')
        ok(records[0].name === 'john', 'matched correct record')
      })
    })
  })

  run(function () {
    comment('find: match (buffer)')
    return test(function (adapter) {
      return adapter.find(type, null, { match: { picture: deadbeef } })
      .then(function (records) {
        ok(records.length === 1, 'match length is correct')
        ok(records[0].picture.equals(deadbeef),
          'matched correct record')
      })
    })
  })

  run(function () {
    comment('find: match (nothing)')
    return test(function (adapter) {
      return adapter.find(type, null, { match: { name: 'bob', age: 36 } })
      .then(function (records) {
        ok(records.length === 0, 'match length is correct')
      })
    })
  })

  run(function () {
    comment('find: sort ascending')
    return test(function (adapter) {
      return adapter.find(type, null, { sort: { age: true } })
      .then(function (records) {
        ok(deepEqual(map(records, function (record) { return record.age }),
          [ 36, 42 ]), 'ascending sort order correct')
      })
    })
  })

  run(function () {
    comment('find: sort descending')
    return test(function (adapter) {
      return adapter.find(type, null, { sort: { age: false } })
      .then(function (records) {
        ok(deepEqual(map(records, function (record) { return record.age }),
          [ 42, 36 ]), 'descending sort order correct')
      })
    })
  })

  run(function () {
    comment('find: sort combination')
    return test(function (adapter) {
      return adapter.find(type, null, { sort: { age: true, name: true } })
      .then(function (records) {
        ok(deepEqual(map(records, function (record) { return record.age }),
          [ 36, 42 ]), 'sort order is correct')
      })
    })
  })

  run(function () {
    comment('find: offset + limit')
    return test(function (adapter) {
      return adapter.find(type, null,
        { offset: 1, limit: 1, sort: { name: true } })
      .then(function (records) {
        ok(records[0].name === 'john', 'record is correct')
        ok(records.length === 1, 'offset length is correct')
      })
    })
  })

  run(function () {
    comment('find: fields #1')
    return test(function (adapter) {
      return adapter.find(type, null,
        { fields: { name: true, isAlive: true } })
      .then(function (records) {
        ok(!find(records, function (record) {
          return Object.keys(record).length !== 3
        }), 'fields length is correct')
      })
    })
  })

  run(function () {
    comment('find: fields #2')
    return test(function (adapter) {
      return adapter.find(type, null,
        { fields: { name: false, isAlive: false } })
      .then(function (records) {
        ok(!find(records, function (record) {
          return Object.keys(record).length !== 10
        }), 'fields length is correct')
      })
    })
  })

  run(function () {
    comment('create: no-op')
    return test(function (adapter) {
      return adapter.create(type, [])
      .then(function (records) {
        ok(deepEqual(records, []), 'response is correct')
      })
    })
  })

  run(function () {
    comment('create: type check')
    return test(function (adapter) {
      var date = new Date()

      return adapter.create(type, [ {
        id: 3,
        picture: deadbeef,
        birthday: date
      } ])
      .then(function (records) {
        ok(deadbeef.equals(records[0].picture),
          'buffer type is correct')
        ok(
          Math.abs(records[0].birthday.getTime() - date.getTime()) < 1000,
          'date value is correct')
      })
    })
  })

  run(function () {
    comment('create: duplicate id creation should fail')
    return test(function (adapter) {
      return adapter.create(type, [ { id: 1 } ])
      .then(function () {
        fail('duplicate id creation should have failed')
      })
      .catch(function (error) {
        ok(error instanceof errors.ConflictError,
          'error type is correct')
      })
    })
  })

  run(function () {
    comment('create: id generation and lookup')
    return test(function (adapter) {
      var id

      return adapter.create(type, [ {
        name: 'joe'
      } ])
      .then(function (records) {
        id = records[0][primaryKey]
        testIds(records, 'id type is correct')

        ok(records[0].picture === null,
          'missing singular value is null')
        ok(deepEqual(records[0].nicknames, []),
          'missing array value is empty array')

        return adapter.find(type, [ id ])
      })
      .then(function (records) {
        ok(records.length === 1, 'match length is correct')
        ok(records[0][primaryKey] === id, 'id is matching')
        testIds(records, 'id type is correct')
      })
    })
  })

  run(function () {
    comment('update: no-op')
    return test(function (adapter) {
      return adapter.update(type, [])
      .then(function (number) {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(function () {
    comment('update: not found')
    return test(function (adapter) {
      return adapter.update(type, [ {
        id: 3,
        replace: { foo: 'bar' }
      } ])
      .then(function (number) {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(function () {
    comment('update: replace')
    return test(function (adapter) {
      return adapter.update(type, [
        { id: 1, replace: { name: 'billy' } },
        { id: 2, replace: { name: 'billy', nicknames: [ 'pepe' ] } }
      ])
      .then(function (number) {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(function (records) {
        ok(deepEqual(find(records, function (record) {
          return record[primaryKey] === 2
        }).nicknames, [ 'pepe' ]), 'array updated')
        ok(filter(records, function (record) {
          return record.name !== 'billy'
        }).length === 0, 'field updated on set')
      })
    })
  })

  run(function () {
    comment('update: unset')
    return test(function (adapter) {
      return adapter.update(type, [
        { id: 1, replace: { name: null } },
        { id: 2, replace: { name: null } }
      ])
      .then(function (number) {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(function (records) {
        ok(filter(records, function (record) {
          return record.name !== null
        }).length === 0, 'field updated on unset')
      })
    })
  })

  run(function () {
    comment('update: push')
    return test(function (adapter) {
      return adapter.update(type, [
        { id: 1, push: { friends: 5 } },
        { id: 2, push: { friends: [ 5 ] } }
      ])
      .then(function (number) {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(function (records) {
        ok(filter(records, function (record) {
          return includes(record.friends, 5)
        }).length === records.length, 'value pushed')
      })
    })
  })

  run(function () {
    comment('update: pull')
    return test(function (adapter) {
      return adapter.update(type, [
        { id: 1, pull: { friends: 2 } },
        { id: 2, pull: { friends: [ 1 ] } }
      ])
      .then(function (number) {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(function (records) {
        ok(filter(records, function (record) {
          return record.friends.length
        }).length === 0, 'value pulled')
      })
    })
  })

  run(function () {
    comment('delete: no-op')
    return test(function (adapter) {
      return adapter.delete(type, [])
      .then(function (number) {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(function () {
    comment('delete')
    return test(function (adapter) {
      return adapter.delete(type, [ 1, 3 ])
      .then(function (number) {
        ok(number === 1, 'number deleted correct')
        return adapter.find(type, [ 1, 2 ])
      })
      .then(function (records) {
        ok(records.count === 1, 'count correct')
        ok(deepEqual(map(records, function (record) {
          return record[primaryKey]
        }), [ 2 ]), 'record deleted')
      })
    })
  })
}


function runTest (a, options, fn) {
  var A, adapter

  // Check if it's a class or a dependency injection function.
  try { a = a(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  A = a
  adapter = new A({
    options: options,
    keys: keys,
    errors: errors,
    message: message,
    recordTypes: recordTypes,
    transforms: {},
    Promise: Promise
  })

  return adapter.connect()
  .then(function () { return adapter.delete(type) })
  .then(function () { return adapter.create(type, records) })
  .then(function () { return fn(adapter) })
  .then(function () {
    return adapter.delete(type,
      map(records, function (record) {
        return record[primaryKey]
      }))
  })
  .then(function () { return adapter.disconnect() })
  .catch(function (error) {
    stderr.error(error)
    adapter.disconnect()
    fail(error)
  })
}


function testIds (records, message) {
  var types = [ 'string', 'number' ]

  ok(find(map(records, function (record) {
    return includes(types, typeof record[primaryKey])
  }), function (x) { return !x }) === void 0, message)
}
