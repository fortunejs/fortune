var vows = require('vows');
var assert = require('assert');


var parser = require('../lib/schemas/parser');
var enforcer = require('../lib/schemas/enforcer');


// suppress warnings
console.warn = function () {};


var schema = parser('person', {
  name: String,
  birthdate: {type: Date},
  mugshot: {type: 'buffer'},
  lucky_numbers: [Number],
  toys: {type: [Object]},
  friends: {link: ['person'], inverse: 'friends'},
  spouse: {link: 'person', inverse: 'spouse'},
  nonexistent: NaN,
  fake: [],
  nested: {thing: String}
});


vows.describe('schema').addBatch({
  'parser': {

    topic: schema,

    'parses native type': function (topic) {
      assert.equal(topic.name.type, 'string');
    },

    'parses object with native type': function (topic) {
      assert.equal(topic.birthdate.type, 'date');
    },

    'parses object with string type': function (topic) {
      assert.equal(topic.mugshot.type, 'buffer');
    },

    'parses array of native type': function (topic) {
      assert.equal(topic.lucky_numbers.type, 'number');
      assert.equal(topic.lucky_numbers.isArray, true);
    },

    'parses object with array of native type': function (topic) {
      assert.equal(topic.toys.type, 'object');
      assert.equal(topic.toys.isArray, true);
    },

    'parses array of links': function (topic) {
      assert.equal(topic.friends.link, 'person');
      assert.equal(topic.friends.inverse, 'friends');
      assert.equal(topic.friends.isArray, true);
    },

    'parses link': function (topic) {
      assert.equal(topic.spouse.link, 'person');
      assert.equal(topic.spouse.inverse, 'spouse');
      assert.equal(!!topic.spouse.isArray, false);
    },

    'drops invalid fields': function (topic) {
      assert.equal(topic.nonexistent, undefined);
      assert.equal(topic.fake, undefined);
      assert.equal(topic.nested, undefined);
    }

  }
}).addBatch({
  'enforcer': {

    topic: function () {
      return enforcer({
        name: {},
        birthdate: 0,
        mugshot: 'SGVsbG8gd29ybGQh',
        lucky_numbers: [1, '2', 3],
        toys: [{foo: 'bar'}, {foo: 'baz'}, 'qq'],
        friends: ['a', 'b', 'c']
      }, schema);
    },

    'casts into string': function (topic) {
      assert.equal(topic.name, '[object Object]');
    },

    'casts into date': function (topic) {
      assert.equal(topic.birthdate, new Date(0).toString());
    },

    'casts into buffer': function (topic) {
      assert.equal(topic.mugshot.toString('utf8'), 'Hello world!');
    },

    'casts into number': function (topic) {
      assert.deepEqual(topic.lucky_numbers, [1, 2, 3]);
    },

    'casts into object': function (topic) {
      assert.equal(topic.toys.length, 3);
      assert.equal(topic.toys[0].foo, 'bar');
      assert.equal(topic.toys[1].foo, 'baz');
      assert.equal(!!topic.toys[2], false);
    },

    'casts into link': function (topic) {
      assert.deepEqual(topic.friends, ['a', 'b', 'c']);
    }

  }
}).addBatch({
  'output': {

    topic: function () {
      return enforcer({
        birthdate: new Date(0),
        mugshot: new Buffer('SGVsbG8gd29ybGQh', 'base64')
      }, schema, true);
    },

    'date outputs timestamp as number': function (topic) {
      assert.equal(topic.birthdate, 0);
    },

    'buffer outputs base64': function (topic) {
      assert.equal(topic.mugshot, 'SGVsbG8gd29ybGQh');
    }

  }
}).export(module);
