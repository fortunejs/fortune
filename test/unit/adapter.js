'use strict'

const run = require('tapdance')

const Adapter = require('../../lib/adapter')
const AdapterSingleton = require('../../lib/adapter/singleton')
const common = require('../../lib/common')
const errors = require('../../lib/common/errors')
const message = require('../../lib/common/message')
const deepEqual = require('../../lib/common/deep_equal')
const map = require('../../lib/common/array/map')
const find = require('../../lib/common/array/find')
const includes = require('../../lib/common/array/includes')
const filter = require('../../lib/common/array/filter')

const keys = require('../../lib/common/keys')
const denormalizedInverseKey = keys.denormalizedInverse
const primaryKey = keys.primary

const type = 'user'

function Integer (x) { return (x | 0) === x }
Integer.prototype = new Number()

const recordTypes = {
  user: {
    name: { type: String },
    age: { type: Integer },
    isAlive: { type: Boolean },
    birthday: { type: Date },
    junk: { type: Object },
    picture: { type: Buffer },
    privateKeys: { type: Buffer, isArray: true },
    nicknames: { type: String, isArray: true },
    friends: { link: 'user', isArray: true, inverse: 'friends' },
    nemesis: { link: 'user', inverse: '__user_nemesis_inverse' },
    '__user_nemesis_inverse': { link: 'user', isArray: true,
      inverse: 'nemesis', [denormalizedInverseKey]: true },
    bestFriend: { link: 'user', inverse: 'bestFriend' }
  }
}

const buffer = Buffer.from ||
  ((input, encoding) => new Buffer(input, encoding))
const deadbeef = buffer('deadbeef', 'hex')
const key1 = buffer('cafe', 'hex')
const key2 = buffer('babe', 'hex')

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

  run((assert, comment) => {
    comment('find: nothing')
    return test(adapter => {
      return adapter.find(type, [])
      .then(records => {
        assert(records.count === 0, 'count is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: id, type checking #1')
    return test(adapter => {
      return adapter.find(type, [ 1 ])
      .then(records => {
        assert(records.count === 1, 'count is correct')
        assert(records[0][primaryKey] === 1, 'id is correct')
        assert(records[0].birthday instanceof Date,
          'date type is correct')
        assert(typeof records[0].isAlive === 'boolean',
          'boolean type is correct')
        assert(typeof records[0].age === 'number',
          'number type is correct')
        assert(deepEqual(records[0].junk, { things: [ 'a', 'b', 'c' ] }),
          'object value is correct')
        assert(!includes(Object.keys(records[0],
          '__user_nemesis_inverse')), 'denormalized fields not enumerable')
      })
    })
  })

  run((assert, comment) => {
    comment('find: id, type checking #2')
    return test(adapter => {
      return adapter.find(type, [ 2 ])
      .then(records => {
        assert(records.count === 1, 'count is correct')
        assert(records[0][primaryKey] === 2, 'id is correct')
        assert(Buffer.isBuffer(records[0].picture),
          'buffer type is correct')
        assert(deadbeef.equals(records[0].picture),
          'buffer value is correct')
        assert(deepEqual(records[0].privateKeys.map(x => x.toString('hex')),
          [ 'cafe', 'babe' ]), 'array of buffers is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: collection')
    return test(adapter => {
      return adapter.find(type)
      .then(records => {
        assert(records.count === 2, 'count is correct')
        testIds(assert, records, 'id type is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: range (number)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: { age: [ 36, 38 ] } }),
        adapter.find(type, null, { range: { age: [ null, 36 ] } })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: range (string)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: { name: [ 'j', null ] } }),
        adapter.find(type, null, { range: { name: [ 'i', 'k' ] } })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: range (date)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: {
          birthday: [ null, new Date() ] } }),
        adapter.find(type, null, { range: {
          birthday: [ new Date(Date.now() - 10 * 1000), new Date() ] } })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'bob', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: range (array)')
    return test(adapter => {
      return Promise.all([
        adapter.find(type, null, { range: {
          privateKeys: [ 1, 2 ] } }),
        adapter.find(type, null, { range: {
          privateKeys: [ 1, null ] } })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: fuzzyMatch')
    return test(adapter => {
      debugger
      return Promise.all([
        adapter.find(type, null, {
          fuzzyMatch: {
            "friends:name": "jo"
          }
        })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'bob', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: fuzzyMatch in this world, the friend of a friend is myself')
    return test(adapter => {
      debugger
      return Promise.all([
        adapter.find(type, null, {
          fuzzyMatch: {
            "friends:friends:name": "jOHn"
          }
        })
      ])
      .then(results => {
        results.forEach((records) => {
          assert(records.length === 1, 'match length is correct')
          assert(records[0].name === 'john', 'matched correct record')
        })
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (string)')
    return test(adapter => {
      return adapter.find(type, null,
        { match: { name: [ 'john', 'xyz' ], age: 36 } })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0].name === 'john', 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (link)')
    return test(adapter => {
      return adapter.find(type, null,
        { match: { friends: 2 } })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0].name === 'bob', 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (buffer)')
    return test(adapter => {
      return adapter.find(type, null, { match: { picture: deadbeef } })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0].picture.equals(deadbeef),
          'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (array containment #1)')
    return test(adapter => {
      return adapter.find(type, null, { match: { privateKeys: key1 } })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (array containment #2)')
    return test(adapter => {
      return adapter.find(type, null, { match: { privateKeys: [ key1 ] } })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: match (nothing)')
    return test(adapter => {
      return adapter.find(type, null, { match: { name: 'bob', age: 36 } })
      .then(records => {
        assert(records.length === 0, 'match length is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: exists (positive)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { picture: true } })
      .then(records => {
        assert(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: exists (negative)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { picture: false } })
      .then(records => {
        assert(records[0][primaryKey] === 1, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: exists (empty array #1)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { privateKeys: true } })
      .then(records => {
        assert(records[0][primaryKey] === 2, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: exists (empty array #2)')
    return test(adapter => {
      return adapter.find(type, null, { exists: { privateKeys: false } })
      .then(records => {
        assert(records[0][primaryKey] === 1, 'matched correct record')
      })
    })
  })

  run((assert, comment) => {
    comment('find: sort ascending')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: true } })
      .then(records => {
        assert(deepEqual(map(records, (record) => { return record.age }),
          [ 36, 42 ]), 'ascending sort order correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: sort descending')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: false } })
      .then(records => {
        assert(deepEqual(map(records, (record) => { return record.age }),
          [ 42, 36 ]), 'descending sort order correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: sort combination')
    return test(adapter => {
      return adapter.find(type, null, { sort: { age: true, name: true } })
      .then(records => {
        assert(deepEqual(map(records, (record) => { return record.age }),
          [ 36, 42 ]), 'sort order is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: offset + limit')
    return test(adapter => {
      return adapter.find(type, null,
        { offset: 1, limit: 1, sort: { name: true } })
      .then(records => {
        assert(records[0].name === 'john', 'record is correct')
        assert(records.length === 1, 'offset length is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: fields #1')
    return test(adapter => {
      return adapter.find(type, null,
        { fields: { name: true, isAlive: true } })
      .then(records => {
        assert(!find(records, (record) => {
          return Object.keys(record).length !== 3
        }), 'fields length is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: fields #2')
    return test(adapter => {
      return adapter.find(type, null,
        { fields: { name: false, isAlive: false } })
      .then(records => {
        assert(!find(records, (record) => {
          return Object.keys(record).length !== 10
        }), 'fields length is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical not #1')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        not: {
          match: { name : 'bob' }
        }
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'john')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical not #2')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        not: {
          exists: { birthday: false }
        }
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'bob', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical not #3')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        not: {
          range: { age: [40, null] }
        }
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'john', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical and #1')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        and: [
          {
            exists: { birthday: true }
          },
          {
            range: { age: [40, null] }
          }
        ]
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'bob', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical or #1')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        or: [
          {
            match: { isAlive: false }
          },
          {
            range: { age: [40, null] }
          }
        ],

        sort: { age: false }
      })
      .then(records => {
        assert(records.length === 2, 'records length is correct')
        assert(records[0].name === 'bob', 'record is correct')
        assert(records[1].name === 'john', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: logical or #2')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        or: [
          {
            match: { isAlive: true }
          },
          {
            range: { age: [40, null] }
          }
        ]
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'bob', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: multiple logical operators #1')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        and: [
          {
            or: [
              {
                match: { isAlive: false }
              },
              {
                match: { isAlive: true },
                range: { age: [40, null] }
              }
            ]
          },
          {
            exists: { birthday: true }
          }
        ]
      })
      .then(records => {
        assert(records.length === 1, 'records length is correct')
        assert(records[0].name === 'bob', 'record is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('find: multiple logical operators #2')
    return test(adapter => {
      if (!adapter.features || !adapter.features.logicalOperators)
        return comment('skipping test')

      return adapter.find(type, null, {
        and: [
          {
            or: [
              {
                match: { isAlive: false },
                range: { age: [40, null] }
              },
              {
                match: { isAlive: true },
                range: { age: [null, 40] }
              }
            ]
          },
          {
            exists: { birthday: false }
          }
        ]
      })
      .then(records => {
        assert(records.length === 0, 'records length is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('create: no-op')
    return test(adapter => {
      return adapter.create(type, [])
      .then(records => {
        assert(deepEqual(records, []), 'response is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('create: type check')
    return test(adapter => {
      const date = new Date()

      return adapter.create(type, [ {
        id: 3,
        picture: deadbeef,
        birthday: date
      } ])
      .then(records => {
        assert(deadbeef.equals(records[0].picture),
          'buffer type is correct')
        assert(
          Math.abs(records[0].birthday.getTime() - date.getTime()) < 1000,
          'date value is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('create: duplicate id creation should fail')
    return test(adapter => {
      return adapter.create(type, [ { id: 1 } ])
      .then(() => {
        assert(false, 'duplicate id creation should have failed')
      })
      .catch(error => {
        assert(error instanceof errors.ConflictError,
          'error type is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('create: id generation and lookup')
    return test(adapter => {
      let id

      return adapter.create(type, [ {
        name: 'joe'
      } ])
      .then(records => {
        id = records[0][primaryKey]
        testIds(assert, records, 'id type is correct')

        assert(records[0].picture === null,
          'missing singular value is null')
        assert(deepEqual(records[0].nicknames, []),
          'missing array value is empty array')

        return adapter.find(type, [ id ])
      })
      .then(records => {
        assert(records.length === 1, 'match length is correct')
        assert(records[0][primaryKey] === id, 'id is matching')
        testIds(assert, records, 'id type is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('create: records returned in same order')
    return test(adapter => {
      let id

      return adapter.create(type, [
        { name: 'a' },
        { name: 'b' },
        { name: 'c' }
      ])
      .then(records => {
        assert(deepEqual(records.map(record => record.name),
          [ 'a', 'b', 'c' ]),
          'records returned in the same order')
      })
    })
  })

  run((assert, comment) => {
    comment('update: no-op')
    return test(adapter => {
      return adapter.update(type, [])
      .then(number => {
        assert(number === 0, 'number is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('update: not found')
    return test(adapter => {
      return adapter.update(type, [ {
        id: 3,
        replace: { foo: 'bar' }
      } ])
      .then(number => {
        assert(number === 0, 'number is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('update: replace')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, replace: { name: 'billy' } },
        { id: 2, replace: { name: 'billy', nicknames: [ 'pepe' ] } }
      ])
      .then(number => {
        assert(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        assert(deepEqual(find(records, (record) => {
          return record[primaryKey] === 2
        }).nicknames, [ 'pepe' ]), 'array updated')
        assert(filter(records, (record) => {
          return record.name !== 'billy'
        }).length === 0, 'field updated on set')
      })
    })
  })

  run((assert, comment) => {
    comment('update: unset')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, replace: { name: null } },
        { id: 2, replace: { name: null } }
      ])
      .then(number => {
        assert(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        assert(filter(records, (record) => {
          return record.name !== null
        }).length === 0, 'field updated on unset')
      })
    })
  })

  run((assert, comment) => {
    comment('update: push')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, push: { friends: 5 } },
        { id: 2, push: { friends: [ 5 ] } }
      ])
      .then(number => {
        assert(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        assert(filter(records, (record) => {
          return includes(record.friends, 5)
        }).length === records.length, 'value pushed')
      })
    })
  })

  run((assert, comment) => {
    comment('update: pull')
    return test(adapter => {
      return adapter.update(type, [
        { id: 1, pull: { friends: 2 } },
        { id: 2, pull: { friends: [ 1 ] } }
      ])
      .then(number => {
        assert(number === 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        assert(filter(records, (record) => {
          return record.friends.length
        }).length === 0, 'value pulled')
      })
    })
  })

  run((assert, comment) => {
    comment('delete: no-op')
    return test(adapter => {
      return adapter.delete(type, [])
      .then(number => {
        assert(number === 0, 'number is correct')
      })
    })
  })

  run((assert, comment) => {
    comment('delete')
    return test(adapter => {
      return adapter.delete(type, [ 1, 3 ])
      .then(number => {
        assert(number === 1, 'number deleted correct')
        return adapter.find(type, [ 1, 2 ])
      })
      .then(records => {
        assert(records.count === 1, 'count correct')
        assert(deepEqual(map(records, (record) => {
          return record[primaryKey]
        }), [ 2 ]), 'record deleted')
      })
    })
  })
}


function runTest (adapterFn, options, fn) {
  let adapter

  try {
    adapter = new AdapterSingleton({
      recordTypes,
      message,
      adapter: [ adapterFn, options ]
    })
  }
  catch (error) { return Promise.reject(error) }

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
  .catch(error => {
    adapter.disconnect()
    throw error
  })
}


function testIds (assert, records, message) {
  const types = [ 'string', 'number' ]

  assert(find(map(records, (record) => {
    return includes(types, typeof record[primaryKey])
  }), (x) => { return !x }) === void 0, message)
}
