import Test from 'tape'
import Adapter from '../../lib/adapter'
import primaryKey from '../../lib/common/primary_key'
import stderr from '../../lib/common/stderr'
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
    friends: { link: 'user', isArray: true },
    bestFriend: { link: 'user' }
  }
}

const records = [{
  name: 'bob',
  alive: true,
  junk: { things: ['a', 'b', 'c'] },
  birthday: new Date(),
  friends: [1, 2, 3]
}, {
  name: 'john',
  alive: false,
  picture: new Buffer('deadbeef'),
  bestFriend: 4
}]


let A = adapters.NeDB

try { A = A(Adapter) }
catch (error) {}


Test('adapter CRUD', t => {
  let adapter = new A({ schemas, options: {} })
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
    .then(() => adapter.delete('user', ids))
    .then(() => adapter.find('user', ids))
    .then(records => {
      t.equal(records.length, 0, 'records have been deleted')
      t.end()
    })
    .catch(error => {
      stderr.error(error.stack)
      throw error
    })
})
