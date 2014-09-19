var vows = require('vows');
var assert = require('assert');


var parser = require('../lib/schemas/parser');
var enforcer = require('../lib/schemas/enforcer');


console.warn = function () {};


var schema = parser('person', {
  name: String,
  birthdate: {type: Date},
  mugshot: {type: Buffer},
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

    'has a name': function (topic) {
      assert.equal(topic.name.type, 'string');
    },

    'has a birthdate': function (topic) {
      assert.equal(topic.birthdate.type, 'date');
    },

    'has a mugshot': function (topic) {
      assert.equal(topic.mugshot.type, 'buffer');
    },

    'has an array of lucky numbers': function (topic) {
      assert.equal(topic.lucky_numbers.type, 'number');
      assert.equal(topic.lucky_numbers.isArray, true);
    },

    'has toys': function (topic) {
      assert.equal(topic.toys.type, 'object');
      assert.equal(topic.toys.isArray, true);
    },

    'has friends': function (topic) {
      assert.equal(topic.friends.link, 'person');
      assert.equal(topic.friends.inverse, 'friends');
      assert.equal(topic.friends.isArray, true);
    },

    'has a spouse': function (topic) {
      assert.equal(topic.spouse.link, 'person');
      assert.equal(topic.spouse.inverse, 'spouse');
      assert.equal(!!topic.spouse.isArray, false);
    },

    'should not have invalid fields': function (topic) {
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

    'into string': function (topic) {
      assert.equal(topic.name, '[object Object]');
    },

    'into date': function (topic) {
      assert.equal(topic.birthdate, new Date(0).toString());
    },

    'into buffer': function (topic) {
      assert.equal(topic.mugshot.toString('utf8'), 'Hello world!');
    },

    'into number': function (topic) {
      assert.deepEqual(topic.lucky_numbers, [1, 2, 3]);
    },

    'into object': function (topic) {
      assert.equal(topic.toys.length, 3);
      assert.equal(topic.toys[0].foo, 'bar');
      assert.equal(topic.toys[1].foo, 'baz');
      assert.equal(!!topic.toys[2], false);
    },

    'into link': function (topic) {
      assert.deepEqual(topic.friends, ['a', 'b', 'c']);
    }

  }
}).export(module);
