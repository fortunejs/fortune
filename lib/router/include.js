var Promise = require('promise');


module.exports = getIncludes;


/**
 * Fetch related entities. Returns an object keyed by type, where
 * the value is an array of related entities.
 *
 * @param {String} type
 * @param {Array} entities
 * @param {Array} include
 * @return {Promise}
 */
function getIncludes (type, entities, include) {
  var schemas = this.schemas;
  var adapter = this.adapter;

  include = include || [];

  return new Promise(function (resolve, reject) {
    var includes = {};

    Promise.all(include.map(function (fields) {
      var container = {
        type: type,
        entities: []
      };

      var chain = fields.reduce(function(entities, field) {
        return entities.then(function (cursor) {
          if (!container.type || !schemas[container.type].hasOwnProperty(field)) {
            container.type = undefined;
            return [];
          }
          container.type = schemas[container.type][field].link;
          return adapter.find(container.type, cursor.reduce(function (ids, entity) {
            var links = Array.isArray(entity[field]) ? entity[field] : [entity[field]];

            links.forEach(function (id) {
              if (!~ids.indexOf(id) && id !== undefined) {
                ids.push(id);
              }
            });

            return ids;
          }, []));
        });
      }, Promise.resolve(entities));

      return new Promise(function (resolve, reject) {
        chain.then(function (entities) {
          container.entities = entities;
          resolve(container);
        }, reject);
      });

    })).then(function (results) {

      results.forEach(function (container) {
        if (container.type === undefined) return;

        includes[container.type] = includes[container.type] || [];

        container.entities.forEach(function (entity) {
          if (!~includes[container.type].indexOf(entity)) {
            includes[container.type].push(entity);
          }
        });
      });

      return resolve(includes);

    }, reject);
  });

}
