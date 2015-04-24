import Test from 'tape'
import fetchTest from './fetch_test'


const contentType = 'application/vnd.api+json'
const accepts = contentType + '; ext=bulk,patch'


Test('create record', t =>
  fetchTest('/animals', {
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
  })
  .then(response => {
    t.equal(response.body.data.type, 'animal', 'type is correct')
    t.end()
  })
  .catch(t.end)
)

Test('find non-existent record', t =>
  fetchTest('/animals/404', {
    method: 'get',
    headers: {
      'Accept': accepts
    }
  })
  .then(response => {
    t.equal(response.status, 404, 'status is correct')
    t.assert('errors' in response.body, 'errors object exists')
    t.equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
    t.assert(response.body.errors[0].detail.length > 0, 'detail exists')
    t.end()
  })
  .catch(t.end)
)
