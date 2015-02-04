var inflection = require('inflection');


module.exports = pluralizeLinked;


function pluralizeLinked (linked) {
	Object.keys(linked).forEach(function (type) {
		if (inflection.pluralize(type) !== type) {
			linked[inflection.pluralize(type)] = linked[type];
			delete linked[type];
		}
	});
}
