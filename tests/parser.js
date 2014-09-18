var vows = require('vows');
var assert = require('assert');


var parser = require('../lib/schemas/parser');


vows.describe('schema parser').addBatch({
	'A person': {
		topic: function () {
			return parser('person', {
				name: String,
				birthdate: {type: Date},
				mugshot: {type: Buffer},
				lucky_numbers: [Number],
				toys: {type: [Object]},
				friends: {link: ['person'], inverse: 'friends'},
				spouse: {link: 'person', inverse: 'spouse'}
			});
		},
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
		}
	}
}).export(module);
