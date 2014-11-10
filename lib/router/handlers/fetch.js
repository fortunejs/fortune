var Promise = require('promise');

var enforcer = require('../../schemas/enforcer');
var include = require('../include');
var transform = require('../transform');


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
  var type = context.type;
  var ids = context.ids;

  // set expected response status
  response.statusCode = 200;

  // disallow arbitrary db queries directly from the client
  delete context.query.find;

  var query = serializer.processQuery.call(_this, context);


  return adapter.find.call(adapter, type, ids, query).then(function (entities) {

    context.entities = entities;
    return include.call(_this, type, entities, query.include);

  }, throwError).then(function (linked) {
    var transforms = [];

    context.linked = linked;

    transforms.push(transform.after.call(_this,
      type, context.entities, request, response));

    Object.keys(linked).forEach(function (key) {
      transforms.push((transform.after.call(_this,
       key, linked[key], request, response)));
    });

    return Promise.all(transforms);

  }, throwError).then(function () {

    context.entities = context.entities.map(function (entity) {
      return enforcer(entity, schemas[type], true);
    });

    Object.keys(context.linked).forEach(function (key) {
      context.linked[key].map(function (entity) {
        return enforcer(entity, schemas[key], true);
      });
    });

    return serializer.showResource.call(_this, context, request, response);

  }, throwError);
}


function throwError (error) {
  throw error instanceof Error ? error : new Error(error);
}
