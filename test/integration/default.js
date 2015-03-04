import Test from 'tape';
import fetchTest from './fetch_test';
import stderr from '../../lib/common/stderr';


export default () => {

  Test('Integration.create', t => fetchTest('/users/5/pets', {
    method: 'post',
    body: {
      data: [{
        __id: 'foo'
      }]
    }
  }, json => {
    stderr.log(json);
    t.equal(json.data.type, 'animal', 'Type is correct.');
    t.equal(json.data.links.owner.id, '5', 'Link is correct.');
    t.end();
  }));

};
