'use strict'

const run = require('tapdance')

const ensureTypes = require('../../lib/record_type/ensure_types')
const validate = require('../../lib/record_type/validate')
const enforce = require('../../lib/record_type/enforce')
const deepEqual = require('../../lib/common/deep_equal')

const keys = require('../../lib/common/keys')
const primaryKey = keys.primary
const linkKey = keys.link
const isArrayKey = keys.isArray
const inverseKey = keys.inverse
const denormalizedInverseKey = keys.denormalizedInverse

const alloc = Buffer.alloc || Buffer
const recordType = 'person'
const fields = {
  // Shorthand definitions.
  s1: String,
  s2: Array(String),
  s3: [ 'person', 's4' ],
  s4: [ Array('person'), 's3' ],
  s5: 'person',
  s6: Array('person'),

  // Standard definitions.
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  integer: { type: Integer },
  luckyNumbers: { type: Number, isArray: true },
  fingerprint: { type: 'buffer' },
  friends: { link: 'person', isArray: true, inverse: 'friends' },
  spouse: { link: 'person', inverse: 'spouse' },
  toys: { type: Object, isArray: true }
}


function testFields (fields) {
  try { return validate(fields) }
  catch (error) { return false }
}

function testField (field) {
  try { return validate({ [field]: fields[field] }) }
  catch (error) { return false }
}

function getField (field) {
  return testField(field)[field]
}

run((assert, comment) => {
  comment('validate field definition')

  // Test for valid fields.
  const valid = 'valid field is valid'

  // Shorthand.
  assert(deepEqual(getField('s1'), {
    type: String
  }), valid)
  assert(deepEqual(getField('s2'), {
    type: String, isArray: true
  }), valid)
  assert(deepEqual(getField('s3'), {
    link: 'person', inverse: 's4'
  }), valid)
  assert(deepEqual(getField('s4'), {
    link: 'person', inverse: 's3', isArray: true
  }), valid)
  assert(deepEqual(getField('s5'), {
    link: 'person'
  }), valid)
  assert(deepEqual(getField('s6'), {
    link: 'person', isArray: true
  }), valid)

  // Standard.
  assert(testField('name'), valid)
  assert(testField('birthdate'), valid)
  assert(testField('mugshot'), valid)
  assert(testField('luckyNumbers'), valid)
  assert(testField('fingerprint'), valid)
  assert(testField('friends'), valid)
  assert(testField('toys'), valid)
  assert(testField('integer'), valid)

  // Test for invalid fields.
  const invalid = 'invalid field throws error'

  assert(!testFields({ badType: true }), invalid)
  assert(!testFields({ nested: { thing: { type: String } } }), invalid)
  assert(!testFields({ thing: { type: 'not' } }), invalid)
  assert(!testFields({
    typeAndLink: { type: String, link: 'y', inverse: 'friends' }
  }), invalid)
  assert(!testFields({ nonexistent: NaN }), invalid)
  assert(!testFields({ nullEdgeCase: null }), invalid)
  assert(!testFields({ fake: { type: 'x' } }), invalid)
})


run((assert, comment) => {
  comment('enforce field definition')

  function testRecord (record) {
    try {
      enforce(recordType, record, fields)
      return true
    }
    catch (error) { return false }
  }

  const bad = 'bad type is bad'
  const good = 'good type is good'

  assert(!testRecord({ [primaryKey]: 1, spouse: 1 }), bad)
  assert(!testRecord({ spouse: [ 2 ] }), bad)
  assert(!testRecord({ friends: 2 }), bad)
  assert(!testRecord({ [primaryKey]: 1, friends: [ 1 ] }), bad)
  assert(!testRecord({ name: {} }), bad)
  assert(testRecord({ name: '' }), good)
  assert(!testRecord({ birthdate: {} }), bad)
  assert(testRecord({ birthdate: new Date() }), good)
  assert(!testRecord({ mugshot: {} }), bad)
  assert(testRecord({ mugshot: alloc(1) }), good)
  assert(!testRecord({ luckyNumbers: 1 }), bad)
  assert(testRecord({ luckyNumbers: [ 1 ] }), good)
  assert(testRecord({ integer: 1 }), good)
  assert(!testRecord({ integer: 1.1 }), bad)
  assert(!testRecord({
    [primaryKey]: 1,
    friends: [ 0, 1, 2 ] }
  ), 'record cannot link to itself')
  assert(deepEqual(enforce(recordType,
    { friends: [ 'a', 'b', 'c', 1, 2, 3 ] }, fields).friends,
    [ 'a', 'b', 'c', 1, 2, 3 ]), 'links are untouched')
  assert(
    enforce(recordType, { random: 'abc' }, fields).random === void 0,
    'arbitrary fields are dropped')
})


run((assert, comment) => {
  comment('ensure record types')

  function check (recordTypes) {
    try {
      ensureTypes(recordTypes)
      return true
    }
    catch (error) { return false }
  }

  assert(!check({
    post: {
      comments: { link: 'comment', isArray: true }
    }
  }), 'record type must exist')

  assert(!check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    }
  }), 'inverse must exist')

  assert(!check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'foo' }
    }
  }), 'inverse is incorrect')

  assert(!check({
    post: {
      comments: { link: 'comment', inverse: 'post' }
    },
    comment: {
      post: { link: 'foo', inverse: 'comments' }
    }
  }), 'inverse link is incorrect')

  assert(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'comments' }
    }
  }), 'valid linking')

  assert(check({
    user: {
      friends: { link: 'user', isArray: true, inverse: 'friends' }
    }
  }), 'self inverse is valid')

  const recordTypes = {
    post: {
      comments: { link: 'comment', isArray: true }
    },
    comment: {}
  }

  ensureTypes(recordTypes)

  const denormalizedField = '__post_comments_inverse'

  assert(recordTypes.post.comments[inverseKey] === denormalizedField,
    'denormalized inverse field assigned')

  assert(recordTypes.comment[denormalizedField][linkKey] === 'post',
    'denormalized inverse field link correct')

  assert(recordTypes.comment[denormalizedField][isArrayKey] === true,
    'denormalized inverse field is array')

  assert(
    recordTypes.comment[denormalizedField][denormalizedInverseKey] === true,
    'denormalized inverse field set')
})


function Integer (x) { return (x | 0) === x }
Integer.prototype = new Number()
