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
		Object.keys(schema).forEach(function (key) {
			if (schema[key].hasOwnProperty('link')) {
				entity.links = entity.links || {};

				// make sure we have blank values
				if (!!schema[key].isArray) entity[key] = entity[key] || [];
				entity.links[key] = entity[key] || null;

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
