import test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.micro+json'


test('show index',
fetchTest('/', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@links']).length,
    3, 'number of types correct')
}))


test('show collection',
fetchTest('/users', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@links']).length,
    1, 'number of types correct')
  t.equal(Object.keys(response.body.user).length,
    3, 'number of records correct')
}))


test('show individual record with include',
fetchTest('/users/1?include=spouse', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.body['@links'].user, 'link type is correct')
  t.equal(Object.keys(response.body.user).length,
    2, 'number of records correct')
}))


test('sort a collection and use sparse fields', fetchTest(
'/users?sort=birthday,-name&fields[user]=name,birthday', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.ok(response.body['@links'].user, 'link type is correct')
  t.deepEqual(
    response.body.user.map(record => record.name),
    [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
    'sort order is correct')
}))


test('match on a collection', fetchTest('/users?match[name]=John Doe', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.ok(response.body['@links'].user, 'link type is correct')
  t.deepEqual(
    response.body.user.map(record => record.name).sort(),
    [ 'John Doe' ], 'match is correct')
}))


test('show related records',
fetchTest('/users/2/pets', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.body['@links'].animal, 'link type is correct')
  t.equal(Object.keys(response.body.animal).length,
    2, 'number of records correct')
}))


test('find an empty collection', fetchTest('/empties', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.body['@links'].empty['@href'],
    '/empties', 'link is correct')
  t.ok(Array.isArray(response.body.empty) && !response.body.empty.length,
    'payload is empty array')
}))


test('find a single non-existent record', fetchTest('/animals/404', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 404, 'status is correct')
  t.ok('@error' in response.body, 'error object exists')
  t.equal(response.body['@error'].name, 'NotFoundError', 'name is correct')
  t.ok(response.body['@error'].message.length, 'message exists')
}))


test('find a collection of non-existent related records',
fetchTest('/users/3/pets', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.ok(response.body['@links'].animal, 'link type is correct')
  t.ok(Array.isArray(response.body.animal) && !response.body.animal.length,
    'payload is empty array')
}))


test('create record', fetchTest('/animals', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    animal: [ {
      name: 'Rover',
      birthday: Date.now(),
      picture: new Buffer('This is a string.').toString('base64'),
      '@links': {
        owner: { '@id': 1 }
      }
    } ]
  }
}, (t, response) => {
  t.equal(response.status, 201, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.headers.get('location').match(/animal/),
    'location header looks right')
  t.ok(response.body.animal, 'type is correct')
  t.equal(new Buffer(response.body.animal[0].picture, 'base64')
    .toString(), 'This is a string.', 'buffer is correct')
  t.ok(Date.now() - new Date(response.body.animal[0].birthday)
    .getTime() < 60 * 1000, 'date is close enough')
}))


test('create record with existing ID should fail', fetchTest('/users', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    user: [ { '@id': 1 } ]
  }
}, (t, response) => {
  t.equal(response.status, 409, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.body['@error'], 'error is correct')
}))


test('update record', fetchTest('/user/2', {
  method: 'patch',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    user: [ {
      '@id': 2,
      name: 'Jenny Death',
      '@links': {
        spouse: { '@id': 3 },
        enemies: { '@id': [ 3 ] },
        friends: { '@id': [ 1, 3 ] }
      }
    } ]
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('delete a single record', fetchTest('/animals/2', {
  method: 'delete',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))
