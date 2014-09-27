module.exports = stripLinks;


/**
 * Strip an entity's links.
 *
 * @param {Object} entity
 * @param {String} type
 * @return {Object}
 */
function stripLinks (entity, type) {
	var schema = this.schemas[type];

	Object.keys(entity).forEach(function (key) {
		if (schema.hasOwnProperty(key) && schema[key].hasOwnProperty('link')) {
			delete entity[key];
		}
	});

	return entity;
}
