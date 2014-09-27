module.exports = linkify;


/**
 * Wrap or unwrap an entity's links.
 *
 * @param {Object} entity
 * @param {String} type
 * @param {Boolean} direction true to wrap, false to unwrap
 * @return {Object}
 */
function linkify (entity, type, direction) {
	var schema = this.schemas[type];

	if (!!direction) {
		Object.keys(entity).forEach(function (key) {
			if (schema.hasOwnProperty(key) && schema[key].hasOwnProperty('link')) {
				entity.links = entity.links || {};
				entity.links[key] = entity[key];
				delete entity[key];
			}
		});
	} else {
		Object.keys(entity.links || {}).forEach(function (key) {
			entity[key] = entity.links[key];
		});
		delete entity.links;
	}

	return entity;
}
