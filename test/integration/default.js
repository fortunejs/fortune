import Test from 'tape'
import fetchTest from './fetch_test'
import stderr from '../../lib/common/stderr'


Test('Integration.create', t => fetchTest('/animals', {
  method: 'post',
  body: {
    data: {
      id: 'foo'
    }
  }
}, json => {
  stderr.log(json)
  t.equal(json.data.type, 'animal', 'type is correct')
  //t.equal(json.data.links.owner.id, '5', 'link is correct')
  t.end()
}))
