import Test from 'tape'
import * as arrayProxy from '../../lib/common/array_proxy'
import * as keys from '../../lib/common/reserved_keys'
import * as errors from '../../lib/common/errors'
import * as stderr from '../stderr'


const type = 'user'

const schemas = {
  user: {
    name: { type: String },
    age: { type: Number },
    isAlive: { type: Boolean },
    birthday: { type: Date },
    junk: { type: Object },
    picture: { type: Buffer },
    nicknames: { type: String, isArray: true },
    friends: { link: 'user', isArray: true, inverse: 'friends' },
    bestFriend: { link: 'user', inverse: 'bestFriend' }
  }
}

const deadbeef = new Buffer(4)
deadbeef.writeUInt32BE(0xdeadbeef, 0)

const records = [
  {
    id: 1,
    name: 'bob',
    age: 42,
    isAlive: true,
    junk: { things: [ 'a', 'b', 'c' ] },
    birthday: new Date(),
    friends: [2],
    bestFriend: 2
  }, {
    id: 2,
    name: 'john',
    age: 36,
    isAlive: false,
    picture: deadbeef,
    friends: [1],
    bestFriend: 1
  }
]


export default (Adapter, options) => {

  Test('find: nothing', t => run(t, adapter =>
    adapter.find(type, [])
    .then(records => {
      t.equal(records.count, 0, 'count is correct')
    })
  ))

  Test('find: collection', t => run(t, adapter =>
    adapter.find(type)
    .then(records => {
      t.equal(records.count, 2, 'count is correct')
    })
  ))

  Test('find: match', t => run(t, adapter =>
    adapter.find(type, null, { match: { name: 'john' } })
    .then(records => {
      t.equal(records.length, 1, 'match length is correct')
      t.ok(records[0].picture.equals(deadbeef), 'buffer is correct')
      t.equal(records[0].name, 'john', 'matched correct record')
    })
  ))

  Test('find: sort ascending', t => run(t, adapter =>
    adapter.find(type, null, { sort: { age: 1 } })
    .then(records => {
      t.deepEqual(records.map(record => record.age), [ 36, 42 ],
        'ascending sort order correct')
    })
  ))

  Test('find: sort descending', t => run(t, adapter =>
    adapter.find(type, null, { sort: { age: -1 } })
    .then(records => {
      t.deepEqual(records.map(record => record.age), [ 42, 36 ],
        'descending sort order correct')
    })
  ))

  Test('find: limit', t => run(t, adapter =>
    adapter.find(type, null, { limit: 1 })
    .then(records => {
      t.equal(records.length, 1, 'limit length is correct')
    })
  ))

  Test('find: offset', t => run(t, adapter =>
    adapter.find(type, null, { offset: 1 })
    .then(records => {
      t.equal(records.length, 1, 'offset length is correct')
    })
  ))

  Test('find: fields', t => run(t, adapter =>
    adapter.find(type, null, { fields: { name: true, isAlive: true } })
    .then(records => {
      t.deepEqual(records.map(record => Object.keys(record).length),
        // We expect 3 fields, because we always get ID.
        Array.from({ length: records.length }).map(() => 3),
        'fields length is correct')
    })
  ))

  Test('update: replace', t => run(t, adapter =>
    adapter.update(type, [
      { id: 1, replace: { name: 'billy' } },
      { id: 2, replace: { name: 'billy' } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.name !== 'billy').length,
        0, 'field updated on set')
    })
  ))

  Test('update: unset', t => run(t, adapter =>
    adapter.update(type, [
      { id: 1, replace: { name: null } },
      { id: 2, replace: { name: null } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.name !== null).length,
        0, 'field updated on unset')
    })
  ))

  Test('update: push', t => run(t, adapter =>
    adapter.update(type, [
      { id: 1, push: { friends: 5 } },
      { id: 2, push: { friends: [5] } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record =>
        arrayProxy.includes(record.friends, 5)).length,
        records.length, 'value pushed')
    })
  ))

  Test('update: pull', t => run(t, adapter =>
    adapter.update(type, [
      { id: 1, pull: { friends: 2 } },
      { id: 2, pull: { friends: [1] } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.friends.length).length,
        0, 'value pulled')
    })
  ))

  function run (t, fn) {
    return adapterTest(Adapter, options, t, fn)
  }

}


function adapterTest (Adapter, options, t, fn) {
  const adapter = new Adapter({
    options: options || {},
    keys, errors, schemas
  })

  adapter.connect()
  .then(() => adapter.delete(type))
  .then(() => adapter.create(type, records))
  .then(r => {
    t.equal(r.length, records.length, 'number created is correct')
    t.equal(arrayProxy.find(r, record => record.id === 1).picture, null,
      'missing field is null')
    return fn(adapter)
  })
  .then(() => adapter.delete(type))
  .then(number => {
    t.equal(number, records.length, 'number deleted is correct')
    return adapter.disconnect()
  })
  .then(t.end)
  .catch(error => {
    stderr.error(error)
    adapter.disconnect()
    t.fail(error)
    t.end()
  })
}
