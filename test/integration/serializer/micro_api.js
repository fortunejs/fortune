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
    .getTime() < 1000, 'date is close enough')
}))


