import Test from 'tape'
import fetchTest from './fetch_test'


Test('Integration.create', t => fetchTest('/animals', {
  method: 'post',
  body: {
    data: {
      id: 'foo'
    }
  }
}, json => {
  t.equal(json.data.type, 'animal', 'type is correct')
  //t.equal(json.data.links.owner.id, '5', 'link is correct')
  t.end()
}))
