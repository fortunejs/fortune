import Test from 'tape'
import Adapter from '../../lib/adapter'
import primaryKey from '../../lib/common/primary_key'
import * as stderr from '../../lib/common/stderr'
import * as adapters from '../../lib/adapter/adapters'


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

const records = [{
  name: 'bob',
  age: 42,
  alive: true,
  junk: { things: [ 'a', 'b', 'c' ] },
  birthday: new Date(),
  friends: [ 1, 2, 3 ]
}, {
  name: 'john',
  age: 36,
  alive: false,
  picture: new Buffer('deadbeef'),
  bestFriend: 4
}]


let A = adapters.NeDB

if (Object.getOwnPropertyNames(A.prototype).length === 1)
  A = A(Adapter)


Test('adapter CRUD', t => {
  const adapter = new A({ schemas })
  let ids

  adapter.initialize()

    // Create.
    .then(() => adapter.create('user', records))
    .then(createdRecords => {
      ids = createdRecords.map(record => record[primaryKey])
      t.equal(
        records.length, createdRecords.length,
        'created records has correct length')
      t.deepEqual(
        records.map(record => record.name),
        createdRecords.map(record => record.name),
        'created records returned in the right order')
      t.equal(
        createdRecords.filter(record => record[primaryKey]).length,
        records.length, 'created records have primary keys')
    })

    // Find: match.
    .then(() => adapter.find('user', ids, { match: { name: 'john' } }))
    .then(records => {
      t.equal(records.length, 1, 'match length is correct')
      t.equal(records[0].name, 'john', 'matched correct record')
    })

    // Find: sort ascending.
    .then(() => adapter.find('user', ids, { sort: { age: 1 } }))
    .then(records => {
      t.equal(records.length, ids.length, 'sort length is correct')
      t.deepEqual(records.map(record => record.age), [ 36, 42 ],
        'ascending sort order correct')
    })

    // Find: sort descending.
    .then(() => adapter.find('user', ids, { sort: { age: -1 } }))
    .then(records => {
      t.equal(records.length, ids.length, 'sort length is correct')
      t.deepEqual(records.map(record => record.age), [ 42, 36 ],
        'descending sort order correct')
    })

    // Find: limit.
    .then(() => adapter.find('user', ids, { limit: 1 }))
    .then(records => {
      t.equal(records.length, 1, 'limit length is correct')
    })

    // Find: offset.
    .then(() => adapter.find('user', ids, { offset: 1 }))
    .then(records => {
      t.equal(records.length, 1, 'offset length is correct')
    })

    // Find: fields.
    .then(() => adapter.find('user', ids, {
      fields: { name: true, alive: true }
    }))
    .then(records => {
      t.equal(records.length, ids.length, 'fields length is correct')
      t.deepEqual(records.map(record => Object.keys(record).length),
        new Array(ids.length).fill(3), // It's 3, because we always get ID.
        'fields length is correct')
    })

    // Update: set.
    .then(() => {
      return adapter.update('user', ids.map(id => ({
        id,
        set: { name: 'billy' }
      })))
    })
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(
        records.length, ids.length,
        'updated records has correct length')
      t.equal(records.filter(record => record.name !== 'billy').length,
        0, 'field updated on set')
    })

    // Update: unset.
    .then(() => {
      return adapter.update('user', ids.map(id => ({
        id,
        unset: { name: true }
      })))
    })
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(
        records.length, ids.length,
        'updated records has correct length')
      t.equal(records.filter(record => record.name).length,
        0, 'field updated on unset')
    })

    // Update: push.
    .then(() => {
      return adapter.update('user', ids.map(id => ({
        id,
        push: { friends: [5] }
      })))
    })
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(
        records.length, ids.length,
        'updated records has correct length')
      t.equal(records.filter(record => ~record.friends.indexOf(5)).length,
        ids.length, 'value pushed')
    })

    // Update: pull.
    .then(() => {
      return adapter.update('user', ids.map(id => ({
        id,
        pull: { friends: [5] }
      })))
    })
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(
        records.length, ids.length,
        'updated records has correct length')
      t.equal(records.filter(record => ~record.friends.indexOf(5)).length,
        0, 'value pulled')
    })

    // Delete.
    .then(() => adapter.delete('user', ids))
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(records.length, 0, 'records have been deleted')
      t.end()
    })

    // Anything goes wrong, it gets caught.
    .catch(error => {
      stderr.error(error)
      throw error
    })
})
