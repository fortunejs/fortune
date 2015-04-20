import Test from 'tape'
import fetchTest from './fetch_test'


const contentType = 'application/vnd.api+json'
const accepts = contentType + '; ext=bulk,patch'


Test('Integration.create', t => fetchTest('/animals', {
  method: 'post',
  body: {
    data: {
      id: 'foo'
    }
  },
  headers: {
    'Accept': accepts,
    'Content-Type': contentType
  }
}, json => {
  t.equal(json.data.type, 'animal', 'type is correct')
  t.end()
}))
