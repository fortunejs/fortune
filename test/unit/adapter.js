import { fail, comment, run } from 'tapdance'
import Adapter from '../../lib/adapter'
import { find, includes } from '../../lib/common/array_proxy'
import * as keys from '../../lib/common/keys'
import * as errors from '../../lib/common/errors'
import * as stderr from '../stderr'
import { ok, equal, deepEqual } from '../helpers'


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
      inverse: 'nemesis', [keys.denormalizedInverse]: true },
    bestFriend: { link: 'user', inverse: 'bestFriend' }
  }
}

const deadbeef = new Buffer('deadbeef', 'hex')
const key1 = new Buffer('cafe', 'hex')
const key2 = new Buffer('babe', 'hex')

const records = [
  {
    [keys.primary]: 1,
    name: 'bob',
    age: 42,
    isAlive: true,
    junk: { things: [ 'a', 'b', 'c' ] },
    birthday: new Date(),
    friends: [ 2 ],
    bestFriend: 2
  }, {
    [keys.primary]: 2,
    name: 'john',
    age: 36,
    isAlive: false,
    picture: deadbeef,
    privateKeys: [ key1, key2 ],
    friends: [ 1 ],
    bestFriend: 1
  }
]


export default function () {
  const test = runTest.bind(null, ...arguments)

  run(() => {
    comment('find: nothing')
    return test(adapter =>
      adapter.find(type, [])
      .then(records => {
        equal(records.count, 0, 'count is correct')
      }))
  })

  run(() => {
    comment('find: id, type checking #1')
    return test(adapter =>
      adapter.find(type, [ 1 ])
      .then(records => {
        equal(records.count, 1, 'count is correct')
        equal(records[0][keys.primary], 1, 'id is correct')
        ok(records[0].birthday instanceof Date,
          'date type is correct')
        equal(typeof records[0].isAlive, 'boolean',
          'boolean type is correct')
        equal(typeof records[0].age, 'number',
          'number type is correct')
        deepEqual(records[0].junk, { things: [ 'a', 'b', 'c' ] },
          'object value is correct')
        ok(!includes(Object.keys(records[0],
          '__user_nemesis_inverse')), 'denormalized fields not enumerable')
      }))
  })

  run(() => {
    comment('find: id, type checking #2')
    return test(adapter =>
      adapter.find(type, [ 2 ])
      .then(records => {
        equal(records.count, 1, 'count is correct')
        equal(records[0][keys.primary], 2, 'id is correct')
        ok(Buffer.isBuffer(records[0].picture),
          'buffer type is correct')
        ok(deadbeef.equals(records[0].picture),
          'buffer value is correct')
        deepEqual(records[0].privateKeys, [ key1, key2 ],
          'array of buffers is correct')
      }))
  })

  run(() => {
    comment('find: collection')
    return test(adapter =>
      adapter.find(type)
      .then(records => {
        equal(records.count, 2, 'count is correct')
        testIds(records, 'id type is correct')
      }))
  })

  run(() => {
    comment('find: match (string)')
    return test(adapter =>
      adapter.find(type, null, { match: { name: [ 'john', 'xyz' ], age: 36 } })
      .then(records => {
        equal(records.length, 1, 'match length is correct')
        equal(records[0].name, 'john', 'matched correct record')
      }))
  })

  run(() => {
    comment('find: match (buffer)')
    return test(adapter =>
      adapter.find(type, null, { match: { picture: deadbeef } })
      .then(records => {
        equal(records.length, 1, 'match length is correct')
        ok(records[0].picture.equals(deadbeef),
          'matched correct record')
      }))
  })

  run(() => {
    comment('find: match (nothing)')
    return test(adapter =>
      adapter.find(type, null, { match: { name: 'bob', age: 36 } })
      .then(records => {
        equal(records.length, 0, 'match length is correct')
      }))
  })

  run(() => {
    comment('find: sort ascending')
    return test(adapter =>
      adapter.find(type, null, { sort: { age: true } })
      .then(records => {
        deepEqual(records.map(record => record.age), [ 36, 42 ],
          'ascending sort order correct')
      }))
  })

  run(() => {
    comment('find: sort descending')
    return test(adapter =>
      adapter.find(type, null, { sort: { age: false } })
      .then(records => {
        deepEqual(records.map(record => record.age), [ 42, 36 ],
          'descending sort order correct')
      }))
  })

  run(() => {
    comment('find: sort combination')
    return test(adapter =>
      adapter.find(type, null, { sort: { age: true, name: true } })
      .then(records => {
        deepEqual(records.map(record => record.age), [ 36, 42 ],
          'sort order is correct')
      }))
  })

  run(() => {
    comment('find: offset + limit')
    return test(adapter =>
      adapter.find(type, null, { offset: 1, limit: 1, sort: { name: true } })
      .then(records => {
        equal(records[0].name, 'john', 'record is correct')
        equal(records.length, 1, 'offset length is correct')
      }))
  })

  run(() => {
    comment('find: fields #1')
    return test(adapter =>
      adapter.find(type, null, { fields: { name: true, isAlive: true } })
      .then(records => {
        ok(records.every(record => Object.keys(record).length === 3),
          'fields length is correct')
      }))
  })

  run(() => {
    comment('find: fields #2')
    return test(adapter =>
      adapter.find(type, null, { fields: { name: false, isAlive: false } })
      .then(records => {
        ok(records.every(record => Object.keys(record).length === 10),
          'fields length is correct')
      }))
  })

  run(() => {
    comment('create: no-op')
    return test(adapter =>
      adapter.create(type, [])
      .then(records => {
        deepEqual(records, [], 'response is correct')
      }))
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
      .then(records => {
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
      return adapter.create(type, [ {
        [keys.primary]: 1
      } ])
      .then(() => {
        fail('duplicate id creation should have failed')
      })
      .catch(error => {
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
      .then(records => {
        id = records[0][keys.primary]
        testIds(records, 'id type is correct')

        equal(records[0].picture, null,
          'missing singular value is null')
        deepEqual(records[0].nicknames, [],
          'missing array value is empty array')

        return adapter.find(type, [ id ])
      })
      .then(records => {
        equal(records.length, 1, 'match length is correct')
        equal(records[0][keys.primary], id, 'id is matching')
        testIds(records, 'id type is correct')
      })
    })
  })

  run(() => {
    comment('update: no-op')
    return test(adapter =>
      adapter.update(type, [])
      .then(number => {
        equal(number, 0, 'number is correct')
      }))
  })

  run(() => {
    comment('update: not found')
    return test(adapter =>
      adapter.update(type, [ {
        [keys.primary]: 3,
        replace: { foo: 'bar' }
      } ])
      .then(number => {
        equal(number, 0, 'number is correct')
      }))
  })

  run(() => {
    comment('update: replace')
    return test(adapter =>
      adapter.update(type, [
        { [keys.primary]: 1, replace: { name: 'billy' } },
        { [keys.primary]: 2,
          replace: { name: 'billy', nicknames: [ 'pepe' ] } }
      ])
      .then(number => {
        equal(number, 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        deepEqual(find(records, record =>
          record[keys.primary] === 2).nicknames, [ 'pepe' ], 'array updated')
        equal(records.filter(record => record.name !== 'billy').length,
          0, 'field updated on set')
      }))
  })

  run(() => {
    comment('update: unset')
    return test(adapter =>
      adapter.update(type, [
        { [keys.primary]: 1, replace: { name: null } },
        { [keys.primary]: 2, replace: { name: null } }
      ])
      .then(number => {
        equal(number, 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        equal(records.filter(record => record.name !== null).length,
          0, 'field updated on unset')
      }))
  })

  run(() => {
    comment('update: push')
    return test(adapter =>
      adapter.update(type, [
        { [keys.primary]: 1, push: { friends: 5 } },
        { [keys.primary]: 2, push: { friends: [ 5 ] } }
      ])
      .then(number => {
        equal(number, 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        equal(records.filter(record =>
          includes(record.friends, 5)).length,
          records.length, 'value pushed')
      }))
  })

  run(() => {
    comment('update: pull')
    return test(adapter =>
      adapter.update(type, [
        { [keys.primary]: 1, pull: { friends: 2 } },
        { [keys.primary]: 2, pull: { friends: [ 1 ] } }
      ])
      .then(number => {
        equal(number, 2, 'number updated correct')
        return adapter.find(type)
      })
      .then(records => {
        equal(records.filter(record => record.friends.length).length,
          0, 'value pulled')
      }))
  })

  run(() => {
    comment('delete: no-op')
    return test(adapter =>
      adapter.delete(type, [])
      .then(number => {
        equal(number, 0, 'number is correct')
      }))
  })

  run(() => {
    comment('delete')
    return test(adapter =>
      adapter.delete(type, [ 1, 3 ])
      .then(number => {
        equal(number, 1, 'number deleted correct')
        return adapter.find(type, [ 1, 2 ])
      })
      .then(records => {
        equal(records.count, 1, 'count correct')
        deepEqual(records.map(record => record[keys.primary]),
          [ 2 ], 'record deleted')
      }))
  })
}


function runTest (a, options = {}, fn) {
  // Check if it's a class or a dependency injection function.
  try { a = a(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  const A = a
  const adapter = new A({
    options, keys, errors, recordTypes
  })

  return adapter.connect()
  .then(() => adapter.delete(type))
  .then(() => adapter.create(type, records))
  .then(() => fn(adapter))
  .then(() => adapter.delete(type,
    records.map(record => record[keys.primary])))
  .then(() => adapter.disconnect())
  .catch(error => {
    stderr.error(error)
    adapter.disconnect()
    fail(error)
  })
}


function testIds (records, message) {
  equal(find(records.map(record =>
    includes([ 'string', 'number' ], typeof record[keys.primary])),
    b => !b), undefined, message)
}
