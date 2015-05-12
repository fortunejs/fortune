import Test from 'tape'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.api+json'


Test('create record', t =>
  fetchTest(t, '/animals', {
    method: 'post',
    body: {
      data: {
        type: 'animal',
        attributes: {
          name: 'Rover',
          birthday: Date.now(),
          picture: new Buffer('This is a string.').toString('base64')
        },
        links: {
          owner: {
            linkage: { type: 'user', id: 1 }
          }
        }
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
    t.equal(new Buffer(response.body.data.attributes.picture, 'base64')
      .toString(), 'This is a string.', 'buffer is correct')
    t.ok(Date.now() - new Date(response.body.data.attributes.birthday)
      .getTime() < 1000, 'date is close enough')
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


Test('update record', t =>
  fetchTest(t, '/user/2', {
    method: 'patch',
    body: {
      data: {
        id: 2,
        type: 'user',
        attributes: {
          name: 'Jenny Death'
        },
        links: {
          spouse: {
            linkage: { type: 'user', id: 3 }
          },
          friends: {
            linkage: [
              { type: 'user', id: 1 },
              { type: 'user', id: 3 }
            ]
          }
        }
      }
    },
    headers: {
      'Accept': mediaType,
      'Content-Type': mediaType
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
  }))


Test('sort a collection and use sparse fields', t =>
  fetchTest(t, '/users?sort=+birthday,-name&fields[user]=name,birthday', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users', 'link is correct')
    t.deepEqual(
      response.body.data.map(record => record.attributes.name),
      [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
      'sort order is correct')
  }))


Test('find a single record with include', t =>
  fetchTest(t, '/animals/1?include=owner', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/animals/1', 'link is correct')
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


Test('delete a single record', t =>
  fetchTest(t, '/animals/2', {
    method: 'delete',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 204, 'status is correct')
    t.equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
  }))


Test('find a collection of non-existent related records', t =>
  fetchTest(t, '/users/3/pets', {
    method: 'get',
    headers: {
      'Accept': mediaType
    }
  }, response => {
    t.equal(response.status, 200, 'status is correct')
    t.equal(response.body.links.self, '/users/3/pets', 'link is correct')
    t.ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  }))
