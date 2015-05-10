import Test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.micro+json'


Test('show index', t =>
  fetchTest(t, '/', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.equal(Object.keys(response.body['@links']).length,
      2, 'number of types correct')
  }))
