module.exports = include;


function include (type, entities, linked) {
  var schemas = this.schemas;
  var adapter = this.adapter;

  linked = linked || [];

  return new Promise(function (resolve, reject) {
    var includes = {};

    Promise.all(linked.map(function (fields) {
      var container = {
        type: type,
        entities: []
      };
      var chain = fields.reduce(function(entities, field) {
        return entities.then(function (cursor) {
          container.type = schemas[container.type][field].link;
          return adapter.find(container.type, cursor.reduce(function (ids, entity) {
            var links = Array.isArray(entity[field]) ? entity[field] : [entity[field]];

            links.forEach(function (id) {
              if (!~ids.indexOf(id)) {
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
