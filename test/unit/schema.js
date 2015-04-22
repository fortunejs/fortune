import Test from 'tape'
import checkSchemas from '../../lib/schema/check_schemas'
import validate from '../../lib/schema/validate'
import enforce from '../../lib/schema/enforce'
import primaryKey from '../../lib/common/primary_key'


const schema = {
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  luckyNumbers: { type: Number, isArray: true },
  friends: { link: 'person', isArray: true, inverse: 'friends' },
  toys: { type: Object, isArray: true },
  location: { type: Symbol('Geo-data') }
}


const testSchema = schema => () => validate(schema)
const testField = field => () => validate({ [field]: schema[field] })


Test('schema validate', t => {
  /// Test for valid fields.
  const valid = 'valid field is valid'

  t.doesNotThrow(testField('name'), valid)
  t.doesNotThrow(testField('birthdate'), valid)
  t.doesNotThrow(testField('mugshot'), valid)
  t.doesNotThrow(testField('luckyNumbers'), valid)
  t.doesNotThrow(testField('friends'), valid)
  t.doesNotThrow(testField('toys'), valid)
  t.doesNotThrow(testField('location'), valid)

  /// Test for invalid fields.
  const invalid = 'invalid field throws error'

  t.throws(testSchema({
    badType: 'asdf'
  }), invalid)

  t.throws(testSchema({
    noInverse: { link: 'person' }
  }), invalid)

  t.throws(testSchema({
    nested: { thing: { type: String } }
  }), invalid)

  t.throws(testSchema({
    typeAndLink: { type: String, link: 'y', inverse: 'friends' }
  }), invalid)

  t.throws(testSchema({
    nonexistent: NaN
  }), invalid)

  t.throws(testSchema({
    nullEdgeCase: null
  }), invalid)

  t.throws(testSchema({
    fake: { type: Array }
  }), invalid)

  t.end()
})


Test('schema enforce', t => {
  const testRecord = record => () => enforce(record, schema)
  const bad = 'bad type is bad'
  const good = 'good type is good'

  t.throws(testRecord({ name: {} }), bad)
  t.doesNotThrow(testRecord({ name: '' }), good)
  t.throws(testRecord({ birthdate: {} }), bad)
  t.doesNotThrow(testRecord({ birthdate: new Date() }), good)
  t.throws(testRecord({ mugshot: {} }), bad)
  t.doesNotThrow(testRecord({ mugshot: new Buffer(1) }), good)
  t.throws(testRecord({ luckyNumbers: 1 }), bad)
  t.doesNotThrow(testRecord({ luckyNumbers: [1] }), good)
  t.throws(testRecord({ friends: 1 }), bad)
  t.throws(testRecord({
    [primaryKey]: 1,
    friends: [ 0, 1, 2 ] }
  ), 'record cannot link to itself')
  t.deepEqual(enforce({ friends: [ 'a', 'b', 'c', 1, 2, 3 ] }, schema).friends,
    [ 'a', 'b', 'c', 1, 2, 3 ], 'links are untouched')
  t.equal(enforce({ random: 'abc' }, schema).random,
    undefined, 'arbitrary fields are dropped')
  t.end()
})


Test('check schema', t => {
  const check = schemas => () => checkSchemas(schemas)

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true }
    }
  }), 'record type must exist')

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    }
  }), 'inverse must exist')

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'foo' }
    }
  }), 'inverse is incorrect')

  t.doesNotThrow(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'comments' }
    }
  }), 'valid linking')

  t.doesNotThrow(check({
    user: {
      friends: { link: 'user', isArray: true, inverse: 'friends' }
    }
  }), 'self inverse is valid')

  t.end()
})
