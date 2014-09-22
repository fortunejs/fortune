var enforcer = require('../../schemas/enforcer');


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
  var args = [context.name, context.id, context.query];

  return adapter.find.apply(adapter, args).then(function (entities) {

    return Promise.all(entities.map(function (entity) {
      var transform = transforms[args[0]];
      if (transform && transform.after) {
        entity = transform.after.call(entity, request, response);
      }
      return entity;
    }));

  }).then(function (entities) {

    context.entities = entities.map(function (entity) {
      return enforcer(entity, schemas[context.name], true);
    });

    return serializer.showCollection.call(_this, context, request, response);

  });
}
