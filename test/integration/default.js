import Test from 'tape';
import fetchTest from './fetch_test';
import stderr from '../../lib/common/stderr';
import primaryKey from '../../lib/common/primary_key';


Test('Integration.create', t => fetchTest('/users/5/pets', {
  method: 'post',
  body: {
    data: [{
      [primaryKey]: 'foo'
    }]
  }
}, json => {
  stderr.log(json);
  t.equal(json.data.type, 'animal', 'type is correct');
  t.equal(json.data.links.owner.id, '5', 'link is correct');
  t.end();
}));
