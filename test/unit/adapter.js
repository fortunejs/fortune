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
  alive: true,
  junk: { things: [ 'a', 'b', 'c' ] },
  birthday: new Date(),
  friends: [ 1, 2, 3 ]
}, {
  name: 'john',
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
    .then(() => adapter.delete('user', ids))
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(records.length, 0, 'records have been deleted')
      t.end()
    })
    .catch(error => {
      stderr.error(error)
      throw error
    })
})
