import test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.micro+json'


test('show index', fetchTest('/', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@links']).length,
    3, 'number of types correct')
  t.ok(!response.body['@links'].user.enemies['@inverse'],
    'denormalized inverse is missing')
}))


test('show collection', fetchTest('/dXNlcnM', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@graph']).length,
    3, 'number of records correct')
}))


test('show individual record with include',
fetchTest('/dXNlcnMvMQ?include=spouse', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@graph']).length,
    2, 'number of records correct')
}))


test('sort a collection and use sparse fields', fetchTest(
'/dXNlcnM?sort=birthday,-name&fields[user]=name,birthday', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.deepEqual(
    response.body['@graph'].map(record => record.name),
    [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
    'sort order is correct')
}))


test('match on a collection', fetchTest('/dXNlcnM?match[name]=John Doe', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.deepEqual(
    response.body['@graph'].map(record => record.name).sort(),
    [ 'John Doe' ], 'match is correct')
}))


test('show related records',
fetchTest('/dXNlcnMvMi9wZXRz', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(Object.keys(response.body['@graph']).length,
    2, 'number of records correct')
}))


test('find an empty collection', fetchTest('/JUUyJTk4JUFGcw', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.ok(Array.isArray(response.body['@graph']) &&
    !response.body['@graph'].length,
    'payload is empty array')
}))


test('find a single non-existent record', fetchTest('/YW5pbWFscy80MDQ', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 404, 'status is correct')
  t.ok('@error' in response.body, 'error object exists')
  t.equal(response.body['@error'].name, 'NotFoundError', 'name is correct')
  t.ok(response.body['@error'].message.length, 'message exists')
}))


test('find a collection of non-existent related records',
fetchTest('/dXNlcnMvMy9wZXRz', {
  method: 'get',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 200, 'status is correct')
  t.ok(Array.isArray(response.body['@graph']) &&
    !response.body['@graph'].length,
    'payload is empty array')
}))


test('create record', fetchTest('/YW5pbWFscw', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    '@graph': [ {
      '@type': 'animal',
      name: 'Rover',
      birthday: Date.now(),
      picture: new Buffer('This is a string.').toString('base64'),
      owner: { 'id': 1 }
    } ]
  }
}, (t, response) => {
  t.equal(response.status, 201, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.headers.get('location'), response.body['@graph'][0]
    ['@id'], 'location header is correct')
  t.ok(response.body['@graph'][0]['@type'], 'type is correct')
  t.equal(response.body['@graph'][0].owner.id, 1, 'link is correct')
  t.equal(new Buffer(response.body['@graph'][0].picture, 'base64')
    .toString(), 'This is a string.', 'buffer is correct')
  t.ok(Date.now() - new Date(response.body['@graph'][0].birthday)
    .getTime() < 60 * 1000, 'date is close enough')
}))


test('create record with existing ID should fail', fetchTest('/dXNlcnM', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    '@graph': [ { '@type': 'user', id: 1 } ]
  }
}, (t, response) => {
  t.equal(response.status, 409, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.body['@error'], 'error exists')
}))


test('create record on wrong route should fail', fetchTest('/dXNlcnMvMQ', {
  method: 'post',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType }
}, (t, response) => {
  t.equal(response.status, 405, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.equal(response.headers.get('allow'),
    'GET, PATCH, DELETE', 'allow header is correct')
  t.ok(response.body['@error'], 'error exists')
}))


test('create record with wrong type should fail', fetchTest('/dXNlcnM', {
  method: 'post',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 415, 'status is correct')
  t.equal(response.headers.get('content-type'), mediaType,
    'content type is correct')
  t.ok(response.body['@error'], 'error exists')
}))


test('update record', fetchTest('/dXNlcnMvMg', {
  method: 'patch',
  headers: { 'Accept': mediaType, 'Content-Type': mediaType },
  body: {
    '@graph': [ {
      '@type': 'user',
      id: 2,
      name: 'Jenny Death',
      spouse: { id: 3 },
      enemies: { id: [ 3 ] },
      friends: { id: [ 1, 3 ] }
    } ]
  }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
}))


test('delete a single record', fetchTest('/YW5pbWFscy8y', {
  method: 'delete',
  headers: { 'Accept': mediaType }
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


test('respond to options: collection', fetchTest('/dXNlcnM', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, POST, PATCH, DELETE', 'allow header is correct')
}))


test('respond to options: IDs',
fetchTest('/dXNlcnMvMQ', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, PATCH, DELETE', 'allow header is correct')
}))


test('respond to options: related', fetchTest('/dXNlcnMvMi9wZXRz', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 204, 'status is correct')
  t.equal(response.headers.get('allow'),
    'GET, PATCH, DELETE', 'allow header is correct')
}))


test('respond to options: fail',
fetchTest('/Zm9v', {
  method: 'options',
  headers: { 'Accept': mediaType }
}, (t, response) => {
  t.equal(response.status, 404, 'status is correct')
}))
