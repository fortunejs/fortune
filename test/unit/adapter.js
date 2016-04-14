'use strict'

const tapdance = require('tapdance')
const ok = tapdance.ok
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run

const Adapter = require('../../lib/adapter')
const errors = require('../../lib/common/errors')

const message = require('../../lib/common/message')
const promise = require('../../lib/common/promise')
const Promise = promise.Promise

const deepEqual = require('../../lib/common/deep_equal')
const map = require('../../lib/common/array/map')
const find = require('../../lib/common/array/find')
const includes = require('../../lib/common/array/includes')
const filter = require('../../lib/common/array/filter')

const keys = require('../../lib/common/keys')
const primaryKey = keys.primary

const type = 'user'

const recordTypes = {
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

const deadbeef = new Buffer('deadbeef', 'hex')
const key1 = new Buffer('cafe', 'hex')
const key2 = new Buffer('babe', 'hex')

const records = [
  {
    id: 1,
    name: 'bob',
    age: 42,
    isAlive: true,
    junk: { things: [ 'a', 'b', 'c' ] },
    birthday: new Date(),
    privateKeys: [],
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


module.exports = (adapter, options) => {
  const test = fn => runTest(adapter, options, fn)

  run(() => {
    comment('find: nothing')
    return test(adapter => {
      return adapter.find(type, [])
      .then((records) => {
        ok(records.count === 0, 'count is correct')
      })
    })
  })

  run(() => {
    comment('find: id, type checking #1')
    return test(adapter => {
      return adapter.find(type, [ 1 ])
      .then((records) => {
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

  run(() => {
    comment('find: id, type checking #2')
    return test(adapter => {
      return adapter.find(type, [ 2 ])
      .then((records) => {
        ok(records.count === 1, 'count is correct')
        ok(records[0][primaryKey] === 2, 'id is correct')
        ok(Buffer.isBuffer(records[0].picture),
          'buffer type is correct')
        ok(deadbeef.equals(records[0].picture),
          'buffer value is correct')
        ok(deepEqual(records[0].privateKeys.map(x => x.toString('hex')),
          [ 'cafe', 'babe' ]), 'array of buffers is correct')
      })
    })
  })

  run(() => {
    comment('find: collection')
    return test(adapter => {
      return adapter.find(type)
      .then((records) => {
        ok(records.count === 2, 'count is correct')
        testIds(records, 'id type is correct')
      })
    })
  })

  run(() => {
    comment('find: range (number)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: { age: [ 36, 38 ] } }),
        adapter.find(type, null, { range: { age: [ null, 36 ] } })
      ])
      .then((results) => {
        results.forEach((records) => {
          ok(records.length === 1, 'match length is correct')
          ok(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run(() => {
    comment('find: range (string)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: { name: [ 'j', null ] } }),
        adapter.find(type, null, { range: { name: [ 'i', 'k' ] } })
      ])
      .then((results) => {
        results.forEach((records) => {
          ok(records.length === 1, 'match length is correct')
          ok(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run(() => {
    comment('find: range (date)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: {
          birthday: [ null, new Date() ] } }),
        adapter.find(type, null, { range: {
          birthday: [ new Date(Date.now() - 10 * 1000), new Date() ] } })
      ])
      .then((results) => {
        results.forEach((records) => {
          ok(records.length === 1, 'match length is correct')
          ok(records[0].name === 'bob', 'matched correct record')
        })
      })
    })
  })

  run(() => {
    comment('find: range (array)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: {
          privateKeys: [ 1, 2 ] } }),
        adapter.find(type, null, { range: {
          privateKeys: [ 1, null ] } })
      ])
      .then((results) => {
        results.forEach((records) => {
          ok(records.length === 1, 'match length is correct')
          ok(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run(() => {
    comment('find: match (string)')
    return test(adapter => {
      return adapter.find(type, null,
        { match: { name: [ 'john', 'xyz' ], age: 36 } })
      .then((records) => {
        ok(records.length === 1, 'match length is correct')
        ok(records[0].name === 'john', 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: match (buffer)')
    return test(adapter => {
      return adapter.find(type, null, { match: { picture: deadbeef } })
      .then((records) => {
        ok(records.length === 1, 'match length is correct')
        ok(records[0].picture.equals(deadbeef),
          'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: match (array containment)')
    return test(adapter => {
      return adapter.find(type, null, { match: { privateKeys: key1 } })
      .then((records) => {
        ok(records.length === 1, 'match length is correct')
        ok(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: match (nothing)')
    return test(adapter => {
      return adapter.find(type, null, { match: { name: 'bob', age: 36 } })
      .then((records) => {
        ok(records.length === 0, 'match length is correct')
      })
    })
  })

  run(() => {
    comment('find: exists (positive)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { picture: true } })
      .then((records) => {
        ok(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: exists (negative)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { picture: false } })
      .then((records) => {
        ok(records[0][primaryKey] === 1, 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: exists (empty array #1)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { privateKeys: true } })
      .then((records) => {
        ok(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: exists (empty array #2)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { privateKeys: false } })
      .then((records) => {
        ok(records[0][primaryKey] === 1, 'matched correct record')
      })
    })
  })

  run(() => {
    comment('find: sort ascending')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: true } })
      .then((records) => {
        ok(deepEqual(map(records, (record) => { return record.age }),
          [ 36, 42 ]), 'ascending sort order correct')
      })
    })
  })

  run(() => {
    comment('find: sort descending')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: false } })
      .then((records) => {
        ok(deepEqual(map(records, (record) => { return record.age }),
          [ 42, 36 ]), 'descending sort order correct')
      })
    })
  })

  run(() => {
    comment('find: sort combination')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: true, name: true } })
      .then((records) => {
        ok(deepEqual(map(records, (record) => { return record.age }),
          [ 36, 42 ]), 'sort order is correct')
      })
    })
  })

  run(() => {
    comment('find: offset + limit')
    return test(adapter => {
      return adapter.find(type, null,
        { offset: 1, limit: 1, sort: { name: true } })
      .then((records) => {
        ok(records[0].name === 'john', 'record is correct')
        ok(records.length === 1, 'offset length is correct')
      })
    })
  })

  run(() => {
    comment('find: fields #1')
    return test(adapter => {
      return adapter.find(type, null,
        { fields: { name: true, isAlive: true } })
      .then((records) => {
        ok(!find(records, (record) => {
          return Object.keys(record).length !== 3
        }), 'fields length is correct')
      })
    })
  })

  run(() => {
    comment('find: fields #2')
    return test(adapter => {
      return adapter.find(type, null,
        { fields: { name: false, isAlive: false } })
      .then((records) => {
        ok(!find(records, (record) => {
          return Object.keys(record).length !== 10
        }), 'fields length is correct')
      })
    })
  })

  run(() => {
    comment('create: no-op')
    return test(adapter => {
      return adapter.create(type, [])
      .then((records) => {
        ok(deepEqual(records, []), 'response is correct')
      })
    })
  })

  run(() => {
    comment('create: type check')
    return test(adapter => {
      const date = new Date()

      return adapter.create(type, [ {
        id: 3,
        picture: deadbeef,
        birthday: date
      } ])
      .then((records) => {
        ok(deadbeef.equals(records[0].picture),
          'buffer type is correct')
        ok(
          Math.abs(records[0].birthday.getTime() - date.getTime()) < 1000,
          'date value is correct')
      })
    })
  })

  run(() => {
    comment('create: duplicate id creation should fail')
    return test(adapter => {
      return adapter.create(type, [ { id: 1 } ])
      .then(() => {
        fail('duplicate id creation should have failed')
      })
      .catch((error) => {
        ok(error instanceof errors.ConflictError,
          'error type is correct')
      })
    })
  })

  run(() => {
    comment('create: id generation and lookup')
    return test(adapter => {
      let id

      return adapter.create(type, [ {
        name: 'joe'
      } ])
      .then((records) => {
        id = records[0][primaryKey]
        testIds(records, 'id type is correct')

        ok(records[0].picture === null,
          'missing singular value is null')
        ok(deepEqual(records[0].nicknames, []),
          'missing array value is empty array')

        return adapter.find(type, [ id ])
      })
      .then((records) => {
        ok(records.length === 1, 'match length is correct')
        ok(records[0][primaryKey] === id, 'id is matching')
        testIds(records, 'id type is correct')
      })
    })
  })

  run(() => {
    comment('update: no-op')
    return test(adapter => {
      return adapter.update(type, [])
      .then((number) => {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(() => {
    comment('update: not found')
    return test(adapter => {
      return adapter.update(type, [ {
        id: 3,
        replace: { foo: 'bar' }
      } ])
      .then((number) => {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(() => {
    comment('update: replace')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, replace: { name: 'billy' } },
        { id: 2, replace: { name: 'billy', nicknames: [ 'pepe' ] } }
      ])
      .then((number) => {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then((records) => {
        ok(deepEqual(find(records, (record) => {
          return record[primaryKey] === 2
        }).nicknames, [ 'pepe' ]), 'array updated')
        ok(filter(records, (record) => {
          return record.name !== 'billy'
        }).length === 0, 'field updated on set')
      })
    })
  })

  run(() => {
    comment('update: unset')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, replace: { name: null } },
        { id: 2, replace: { name: null } }
      ])
      .then((number) => {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then((records) => {
        ok(filter(records, (record) => {
          return record.name !== null
        }).length === 0, 'field updated on unset')
      })
    })
  })

  run(() => {
    comment('update: push')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, push: { friends: 5 } },
        { id: 2, push: { friends: [ 5 ] } }
      ])
      .then((number) => {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then((records) => {
        ok(filter(records, (record) => {
          return includes(record.friends, 5)
        }).length === records.length, 'value pushed')
      })
    })
  })

  run(() => {
    comment('update: pull')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, pull: { friends: 2 } },
        { id: 2, pull: { friends: [ 1 ] } }
      ])
      .then((number) => {
        ok(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then((records) => {
        ok(filter(records, (record) => {
          return record.friends.length
        }).length === 0, 'value pulled')
      })
    })
  })

  run(() => {
    comment('delete: no-op')
    return test(adapter => {
      return adapter.delete(type, [])
      .then((number) => {
        ok(number === 0, 'number is correct')
      })
    })
  })

  run(() => {
    comment('delete')
    return test(adapter => {
      return adapter.delete(type, [ 1, 3 ])
      .then((number) => {
        ok(number === 1, 'number deleted correct')
        return adapter.find(type, [ 1, 2 ])
      })
      .then((records) => {
        ok(records.count === 1, 'count correct')
        ok(deepEqual(map(records, (record) => {
          return record[primaryKey]
        }), [ 2 ]), 'record deleted')
      })
    })
  })
}


function runTest (a, options, fn) {
  let A, adapter

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
  .then(() => adapter.delete(type))
  .then(() => adapter.create(type, records))
  .then(() => fn(adapter))
  .then(() => {
    return adapter.delete(type,
      map(records, (record) => {
        return record[primaryKey]
      }))
  })
  .then(() => adapter.disconnect())
  .catch((error) => {
    adapter.disconnect()
    fail(error)
  })
}


function testIds (records, message) {
  const types = [ 'string', 'number' ]

  ok(find(map(records, (record) => {
    return includes(types, typeof record[primaryKey])
  }), (x) => { return !x }) === void 0, message)
}
