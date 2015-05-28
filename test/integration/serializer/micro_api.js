import test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.micro+json'


test('show index', t =>
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
      3, 'number of types correct')
  }))

test('show collection', t =>
  fetchTest(t, '/users', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.equal(Object.keys(response.body['@links']).length,
      1, 'number of types correct')
    t.equal(Object.keys(response.body.user).length,
      3, 'number of records correct')
  }))
