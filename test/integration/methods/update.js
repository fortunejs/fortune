import { pass, fail, run, comment, deepEqual, equal } from 'tapdance'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array'

var constants = require('../../../lib/common/constants')
var changeEvent = constants.change
var updateMethod = constants.update
var primaryKey = constants.primary


run(() => {
  comment('update one to one with 2nd degree unset')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 3,
        replace: { spouse: 2 }
      }
    ],
    relatedType: 'user',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).spouse, null,
        '2nd degree related field unset')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).spouse, 3,
        'related field set')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).spouse, 2,
        'field updated')
    }
  })
})


run(() => {
  comment('update one to one with former related record')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        replace: { spouse: 3 }
      }
    ],
    relatedType: 'user',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).spouse, null,
        'related field unset')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).spouse, 3,
        'field updated')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).spouse, 2,
        'related field set')
    }
  })
})


run(() => {
  comment('update one to one with same value')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        replace: { spouse: 1 }
      }
    ],
    relatedType: 'user',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).spouse, 2,
        'related field is same')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).spouse, 1,
        'field is same')
    }
  })
})


run(() => {
  comment('update one to one with multiple same value should fail')

  return testInstance()
  .then(store => store.request({
    method: updateMethod,
    type: 'user',
    payload: [
      { [primaryKey]: 2, replace: { spouse: 1 } },
      { [primaryKey]: 3, replace: { spouse: 1 } }
    ]
  }))
  .then(() => {
    fail('should have failed')
  })
  .catch(() => {
    pass('multiple same values failed')
  })
})


run(() => {
  comment('update one to one with null value')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        replace: { spouse: null }
      }
    ],
    relatedType: 'user',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).spouse, null,
        'related field is updated')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).spouse, null,
        'field is updated')
    }
  })
})


run(() => {
  comment('update one to many (set)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].animal,
        [ 1 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows related update IDs')
    },
    type: 'animal',
    payload: [
      {
        [primaryKey]: 1,
        replace: { owner: 2 }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).ownedPets, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).ownedPets.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'related field pushed')
    }
  })
})


run(() => {
  comment('update one to many (unset)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].animal,
        [ 1 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1 ], 'change event shows related update IDs')
    },
    type: 'animal',
    payload: [
      {
        [primaryKey]: 1,
        replace: { owner: null }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).ownedPets, [],
        'related field pulled')
    }
  })
})


run(() => {
  comment('update many to one (push)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal,
        [ 1 ], 'change event shows related update IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        push: { ownedPets: 1 }
      }
    ],
    relatedType: 'animal',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).owner, 2,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (push) with 2nd degree')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user,
        [ 1, 2 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal,
        [ 2 ], 'change event shows related update IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 1,
        push: { ownedPets: 2 }
      }
    ],
    relatedType: 'animal',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).owner, 1,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (pull)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user,
        [ 2 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal,
        [ 2, 3 ], 'change event shows related update IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        pull: { ownedPets: [ 2, 3 ] }
      }
    ],
    relatedType: 'animal',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).owner, null,
        'related field set')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).owner, null,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (set)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 3,
        replace: { ownedPets: [ 1, 2, 3 ] }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).ownedPets, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).ownedPets, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).ownedPets, [ 1, 2, 3 ],
        'field set')
    }
  })
})


run(() => {
  comment('update many to one (set) #2')
  return updateTest({
    type: 'user',
    payload: [
      {
        [primaryKey]: 3,
        replace: { ownedPets: [ 1, 2, 3 ] }
      }
    ],
    relatedType: 'animal',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).owner, 3,
        'related field set')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).owner, 3,
        'related field set')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).owner, 3,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (set) #3')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal.sort((a, b) => a - b),
        [ 1, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        replace: { ownedPets: [ 1, 2 ] }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).ownedPets, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).ownedPets, [ 1, 2 ],
        'field set')
    }
  })
})


run(() => {
  comment('update many to one (unset)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 2 ], 'change event shows updated IDs')
      deepEqual(data[updateMethod].animal.sort((a, b) => a - b),
        [ 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 2,
        replace: { ownedPets: [] }
      }
    ],
    relatedType: 'animal',
    related: response => {
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).owner, null,
        'related field unset')
      equal(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).owner, null,
        'related field unset')
    }
  })
})


run(() => {
  comment('update many to many (push)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 1,
        push: { friends: 2 }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).friends.sort((a, b) => a - b),
        [ 1, 3 ], 'related ID pushed')
    }
  })
})


run(() => {
  comment('update many to many (pull)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 3,
        pull: { friends: 2 }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).friends, [],
        'related ID pulled')
    }
  })
})


run(() => {
  comment('update many to many (set)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 1,
        replace: { friends: [ 2, 3 ] }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).friends.sort((a, b) => a - b),
        [ 2, 3 ], 'field set')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).friends.sort((a, b) => a - b),
        [ 1, 3 ], 'related field pushed')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).friends.sort((a, b) => a - b),
        [ 1, 2 ], 'field unchanged')
    }
  })
})


run(() => {
  comment('update many to many (unset)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 3,
        replace: { friends: [] }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).friends, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2).friends, [],
        'related field pulled')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3).friends, [],
        'field set')
    }
  })
})


run(() => {
  comment('update many to many (denormalized inverse)')
  return updateTest({
    change: data => {
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 2, 3 ], 'change event shows updated IDs')
    },
    type: 'user',
    payload: [
      {
        [primaryKey]: 1,
        replace: { enemies: [ 2, 3 ] }
      }
    ],
    relatedType: 'user',
    related: response => {
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1).enemies.sort((a, b) => a - b),
        [ 2, 3 ], 'field set')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 1)['__user_enemies_inverse'],
        [], 'denormalized inverse field exists')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 2)['__user_enemies_inverse'],
        [ 1 ], 'related field updated')
      deepEqual(arrayProxy.find(response.payload,
        record => record[primaryKey] === 3)['__user_enemies_inverse']
        .sort((a, b) => a - b), [ 1, 2 ], 'related field updated')
    }
  })
})


function updateTest (o) {
  let store

  return testInstance()

  .then(instance => {
    store = instance

    if (o.change)
      store.on(changeEvent, data => o.change(data))

    return store.request({
      method: updateMethod,
      type: o.type,
      payload: o.payload
    })
  })

  .then(() => store.request({
    type: o.relatedType
  }))

  .then(response => o.related(response))

  .then(() => store.disconnect())

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
}
