import test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.api+json'


test('create record', t =>
  fetchTest(t, '/animals', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        type: 'animal',
        attributes: {
          name: 'Rover',
          birthday: Date.now(),
          picture: new Buffer('This is a string.').toString('base64')
        },
        relationships: {
          owner: {
            data: { type: 'user', id: 1 }
          }
        }
      }
    }
  }, response => {
    t.equal(response.status, 201, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.ok(response.headers.get('location').match(/animal/),
      'location header looks right')
    t.equal(response.body.data.type, 'animal', 'type is correct')
    t.equal(new Buffer(response.body.data.attributes.picture, 'base64')
      .toString(), 'This is a string.', 'buffer is correct')
    t.ok(Date.now() - new Date(response.body.data.attributes.birthday)
      .getTime() < 1000, 'date is close enough')
  }))


test('create record with existing ID should fail', t =>
  fetchTest(t, '/users', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        id: 1,
        type: 'user'
      }
    }
  }, response => {
    t.equal(response.status, 409, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    t.equal(response.body.errors.length, 1, 'error is correct')
  }))


test('update record', t =>
  fetchTest(t, '/user/2', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        id: 2,
        type: 'user',
        attributes: {
          name: 'Jenny Death'
        },
        relationships: {
          spouse: {
            data: { type: 'user', id: 3 }
          },
          enemies: {
            data: [
              { type: 'user', id: 3 }
            ]
          },
          friends: {
            data: [
              { type: 'user', id: 1 },
              { type: 'user', id: 3 }
            ]
          }
        }
      }
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))


test('sort a collection and use sparse fields', t =>
  fetchTest(t, '/users?sort=+birthday,-name&fields[user]=name,birthday', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users', 'link is correct')
    t.deepEqual(
      response.body.data.map(record => record.attributes.name),
      [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
      'sort order is correct')
  }))


test('filter a collection', t =>
  fetchTest(t, '/users?filter[name]=John Doe', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users', 'link is correct')
    t.deepEqual(
      response.body.data.map(record => record.attributes.name).sort(),
      [ 'John Doe' ], 'match is correct')
  }))


test('find a single record with include', t =>
  fetchTest(t, '/animals/1?include=owner,owner.friends', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/animals/1', 'link is correct')
    t.equal(response.body.data.id, '1', 'id is correct')
    t.deepEqual(response.body.included.map(record => record.type),
      [ 'user', 'user' ], 'type is correct')
    t.deepEqual(response.body.included.map(record => record.id)
      .sort((a, b) => a - b), [ '1', '3' ], 'id is correct')
  }))


test('find a single non-existent record', t =>
  fetchTest(t, '/animals/404', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 404, 'status is correct')
    t.ok('errors' in response.body, 'errors object exists')
    t.equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
    t.ok(response.body.errors[0].detail.length, 'detail exists')
  }))


test('delete a single record', t =>
  fetchTest(t, '/animals/2', {
    method: 'delete',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))


test('find a collection of non-existent related records', t =>
  fetchTest(t, '/users/3/pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/3/pets', 'link is correct')
    t.ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  }))


test('find an empty collection', t =>
  fetchTest(t, '/empties', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/empties', 'link is correct')
    t.ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  }))


test('get an array relationship entity', t =>
  fetchTest(t, '/users/2/relationships/pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/2/relationships/pets',
      'link is correct')
    t.deepEqual(response.body.data.map(data => data.id), [ 2, 3 ],
      'ids are correct')
  }))


test('get an empty array relationship entity', t =>
  fetchTest(t, '/users/3/relationships/pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/3/relationships/pets',
      'link is correct')
    t.deepEqual(response.body.data, [], 'data is correct')
  }))


test('get a singular relationship entity', t =>
  fetchTest(t, '/users/1/relationships/spouse', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/1/relationships/spouse',
      'link is correct')
    t.equal(response.body.data.type, 'user', 'type is correct')
    t.equal(response.body.data.id, 2, 'id is correct')
  }))


test('get an empty singular relationship entity', t =>
  fetchTest(t, '/users/3/relationships/spouse', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/3/relationships/spouse',
      'link is correct')
    t.equal(response.body.data, null, 'data is correct')
  }))


test('update a singular relationship entity', t =>
  fetchTest(t, '/users/2/relationships/spouse', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: { type: 'user', id: 3 }
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))


test('update an array relationship entity', t =>
  fetchTest(t, '/users/1/relationships/pets', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animal', id: 2 } ]
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))


test('post to an array relationship entity', t =>
  fetchTest(t, '/users/1/relationships/pets', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animal', id: 2 } ]
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))


test('delete from an array relationship entity', t =>
  fetchTest(t, '/users/1/relationships/friends', {
    method: 'delete',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'user', id: 3 } ]
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
  }))
