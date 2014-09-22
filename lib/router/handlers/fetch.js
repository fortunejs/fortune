var enforcer = require('../../schemas/enforcer');
var include = require('../include');

module.exports = fetch;


/**
 * Retrieve entities from database.
 *
 * @param {Object} context
 * @param {Object} request
 * @param {Object} response
 * @return {Promise}
 */
function fetch (context, request, response) {
  var _this = this;
  var schemas = this.schemas;
  var adapter = this.adapter;
  var serializer = this.serializer;
  var transforms = this.transforms;
  var type = context.type;
  var ids = context.ids;

  // disallow arbitrary db queries directly from the client
  delete context.query.query;

  var query = serializer.processQuery.call(_this, context.query);


  return adapter.find.call(adapter, type, ids, query).then(function (entities) {
    context.entities = entities;

    // madness about getting linked entities
    return include.call(_this, type, entities, query.linked);

  }).then(function (linked) {
    context.linked = linked;

    return Promise.all(context.entities.map(function (entity) {
      var transform = transforms[type];

      if (!!transform && transform.after) {
        entity = transform.after.call(entity, request, response);
      }

      return entity;
    }));

  }).then(function (entities) {

    context.entities = entities.map(function (entity) {
      return enforcer(entity, schemas[type], true);
    });

    return serializer.showCollection.call(_this, context, request, response);

  });
}
