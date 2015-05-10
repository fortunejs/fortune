import Test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.api+json'


Test('create record', t =>
  fetchTest(t, '/animals', {
    method: 'post',
    body: {
      data: {
        id: 4,
        type: 'animal',
        name: 'Rover',
        owner: 1
      }
    },
    headers: {
      'Accept': mediaType,
      'Content-Type': mediaType
    }
  }, response => {
    t.equal(response.status, 201, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.ok(response.headers.get('location').match(/animal/),
      'location header looks right')
    t.equal(response.body.data.type, 'animal', 'type is correct')
  }))


Test('create record with existing ID should fail', t =>
  fetchTest(t, '/users', {
    method: 'post',
    body: {
      data: {
        id: 1,
        type: 'user'
      }
    },
    headers: {
      'Accept': mediaType,
      'Content-Type': mediaType
    }
  }, response => {
    t.equal(response.status, 409, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.equal(response.body.errors.length, 1, 'error is correct')
  }))


Test('find a single record with include', t =>
  fetchTest(t, '/animals/1?include=owner', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.data.id, '1', 'id is correct')
    t.equal(response.body.included[0].type, 'user', 'type is correct')
    t.equal(response.body.included[0].id, '1', 'id is correct')
  }))


Test('find a single non-existent record', t =>
  fetchTest(t, '/animals/404', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 404, 'status is correct')
    t.ok('errors' in response.body, 'errors object exists')
    t.equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
    t.ok(response.body.errors[0].detail.length, 'detail exists')
  }))
