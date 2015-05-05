import Test from 'tape'
import fetchTest from '../fetch_test'

const mediaType = 'application/vnd.api+json'


Test('create record', t => fetchTest('/animals', {
  method: 'post',
  body: {
    data: {
      id: 4,
      name: 'Rover',
      owner: 1
    }
  },
  headers: {
    'Accept': mediaType,
    'Content-Type': mediaType
  }
})

.then(response => {
  t.equal(response.status, 201, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.body.data.type, 'animal', 'type is correct')
  t.end()
}))


Test('find non-existent record', t => fetchTest('/animals/404', {
  method: 'get',
  headers: {
    'Accept': mediaType
  }
})

.then(response => {
  t.equal(response.status, 404, 'status is correct')
  t.assert('errors' in response.body, 'errors object exists')
  t.equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
  t.assert(response.body.errors[0].detail.length, 'detail exists')
  t.end()
}))
