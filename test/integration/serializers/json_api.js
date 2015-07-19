import test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.api+json'


test('get ad-hoc index', fetchTest('/', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
}))


test('create record', fetchTest('/animals', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: {
      id: 4,
      type: 'animal',
      attributes: {
        name: 'Rover',
        type: 'Chihuahua',
        birthday: Date.now(),
        picture: new Buffer('This is a string.').toString('base64')
      },
      relationships: {
        owner: {
          data: { type: 'users', id: 1 }
        }
      }
    }
  }
}, (t, response) => {
  t.equal(response.status, 201, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.headers.get('location'), '/animals/4',
    'location header looks right')
  t.equal(response.body.data.type, 'animals', 'type is correct')
  t.equal(new Buffer(response.body.data.attributes.picture, 'base64')
    .toString(), 'This is a string.', 'buffer is correct')
  t.ok(Date.now() - new Date(response.body.data.attributes.birthday)
    .getTime() < 60 * 1000, 'date is close enough')
}))


test('create record with existing ID should fail', fetchTest('/users', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: {
      id: 1,
      type: 'user'
    }
  }
}, (t, response) => {
  t.equal(response.status, 409, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.body.errors.length, 1, 'error is correct')
}))

test('create record with wrong route should fail', fetchTest('/users/4', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType }
}, (t, response) => {
  t.equal(response.status, 405, 'status is correct')
  t.equal(response.headers.get('allow'), 'GET, PATCH, DELETE',
    'allow header is correct')
  t.equal(response.body.errors.length, 1, 'error exists')
}))


test('create record with wrong type should fail', fetchTest('/users', {
  method: 'post',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 415, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.body.errors.length, 1, 'error exists')
}))


test('update record', fetchTest('/users/2', {
  method: 'patch',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: {
      id: 2,
      type: 'users',
      attributes: {
        name: 'Jenny Death'
      },
      relationships: {
        spouse: {
          data: { type: 'users', id: 3 }
        },
        enemies: {
          data: [
            { type: 'users', id: 3 }
          ]
        },
        friends: {
          data: [
            { type: 'users', id: 1 },
            { type: 'users', id: 3 }
          ]
        }
      }
    }
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('sort a collection and use sparse fields', fetchTest(
'/users?sort=birthday,-name&fields[user]=name,birthday', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users', 'link is correct')
  t.deepEqual(
    response.body.data.map(record => record.attributes.name),
    [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
    'sort order is correct')
}))


test('filter a collection', fetchTest('/users?filter[name]=John Doe', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users', 'link is correct')
  t.deepEqual(
    response.body.data.map(record => record.attributes.name).sort(),
    [ 'John Doe' ], 'match is correct')
}))


test('find a single record with include',
fetchTest('/animals/1?include=owner,owner.friends', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/animals/1', 'link is correct')
  t.equal(response.body.data.id, '1', 'id is correct')
  t.deepEqual(response.body.included.map(record => record.type),
    [ 'users', 'users' ], 'type is correct')
  t.deepEqual(response.body.included.map(record => record.id)
    .sort((a, b) => a - b), [ '1', '3' ], 'id is correct')
}))


test('find a single non-existent record', fetchTest('/animals/404', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 404, 'status is correct')
  t.ok('errors' in response.body, 'errors object exists')
  t.equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
  t.ok(response.body.errors[0].detail.length, 'detail exists')
}))


test('delete a single record', fetchTest('/animals/2', {
  method: 'delete',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('find a collection of non-existent related records',
fetchTest('/users/3/pets', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users/3/pets', 'link is correct')
  t.ok(Array.isArray(response.body.data) && !response.body.data.length,
    'data is empty array')
}))


test('find an empty collection', fetchTest('/☯s', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self,
    encodeURI('/☯s'), 'link is correct')
  t.ok(Array.isArray(response.body.data) && !response.body.data.length,
    'data is empty array')
}))


test('get an array relationship entity',
fetchTest('/users/2/relationships/pets', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users/2/relationships/pets',
    'link is correct')
  t.deepEqual(response.body.data.map(data => data.id), [ 2, 3 ],
    'ids are correct')
}))


test('get an empty array relationship entity',
fetchTest('/users/3/relationships/pets', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users/3/relationships/pets',
    'link is correct')
  t.deepEqual(response.body.data, [], 'data is correct')
}))


test('get a singular relationship entity',
fetchTest('/users/1/relationships/spouse', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users/1/relationships/spouse',
    'link is correct')
  t.equal(response.body.data.type, 'users', 'type is correct')
  t.equal(response.body.data.id, 2, 'id is correct')
}))


test('get an empty singular relationship entity',
fetchTest('/users/3/relationships/spouse', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body.links.self, '/users/3/relationships/spouse',
    'link is correct')
  t.equal(response.body.data, null, 'data is correct')
}))


test('update a singular relationship entity',
fetchTest('/users/2/relationships/spouse', {
  method: 'patch',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: { type: 'users', id: 3 }
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('update an array relationship entity',
fetchTest('/users/1/relationships/pets', {
  method: 'patch',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: [ { type: 'animals', id: 2 } ]
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('post to an array relationship entity',
fetchTest('/users/1/relationships/pets', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: [ { type: 'animals', id: 2 } ]
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('delete from an array relationship entity',
fetchTest('/users/1/relationships/friends', {
  method: 'delete',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    data: [ { type: 'users', id: 3 } ]
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('respond to options: index', fetchTest('/', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET', 'allow header is correct')
}))


test('respond to options: collection', fetchTest('/animals', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, POST', 'allow header is correct')
}))


test('respond to options: individual',
fetchTest('/animals/1', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, PATCH, DELETE', 'allow header is correct')
}))


test('respond to options: link', fetchTest('/animals/1/owner', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET', 'allow header is correct')
}))


test('respond to options: relationships',
fetchTest('/animals/1/relationships/owner', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, POST, PATCH, DELETE', 'allow header is correct')
}))


test('respond to options: fail',
fetchTest('/foo', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 404, 'status is correct')
}))
