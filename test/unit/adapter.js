import Test from 'tape';
import Adapter from '../../lib/adapter';
import stderr from '../../lib/common/stderr';
import primaryKey from '../../lib/common/primary_key';
import * as adapters from '../../lib/adapter/adapters';

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
};

const records = [{
  name: 'bob',
  alive: true,
  junk: { things: ['a', 'b', 'c'] },
  birthday: new Date()
}, {
  name: 'john',
  alive: false,
  picture: new Buffer('deadbeef')
}];


let A = adapters.NeDB;

try { A = A(Adapter); }
catch (error) {}


Test('adapter CRUD', t => {
  let adapter = new A({ schemas, options: {} });

  adapter.initialize()
    .then(() => adapter.create('user', records))
    .then(createdRecords => {
      t.equal(
        records.length, createdRecords.length,
        'created records has correct length');
      t.deepEqual(
        records.map(record => record.name),
        createdRecords.map(record => record.name),
        'created records returned in the right order');
      t.equal(
        createdRecords.filter(record => record[primaryKey]).length,
        records.length, 'created records have primary keys');
      t.end();
    })
    .catch(error => {
      stderr.error(error.stack);
      throw error;
    });
});
