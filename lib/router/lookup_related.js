var Promise = require('promise');


module.exports = lookupRelated;


/*!
 * Lookup the IDs of related entities ahead of time.
 *
 * @param {Object} context
 * @param {String} field
 * @return {Promise}
 */
function lookupRelated (context, field) {
  var relatedType = this.schemas[context.type][field].link;
  var fields = {};

  fields[field] = 1;

  return this.adapter.find(context.type, context.ids, {
    fields: fields
  }).then(function (entities) {
    var relatedIds = [];

    entities.forEach(function (entity) {
      var ids = Array.isArray(entity[field]) ?
        entity[field] : [entity[field]];

      ids.forEach(function (id) {
        if (!!id && !~relatedIds.indexOf(id)) relatedIds.push(id);
      });
    });

    context.ids = relatedIds;
    context.type = relatedType;

    return Promise.resolve();
  });
}
