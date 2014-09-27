var inflection = require('inflection');
var stringify = require('./stringify');
var linkify = require('./linkify');
var pluralizeLinked = require('./pluralize_linked');
var stripLinks = require('./strip_links');


module.exports = showResource;


function showResource (context) {
  var _this = this;
  var object = {};
  var inflect = !!this.options.inflect;
  var key = inflect ? inflection.pluralize(context.type) : context.type;

  context.entities.map(function (entity) {
    return linkify.call(_this, entity, context.type, true);
  });

  Object.keys(context.linked).forEach(function (type) {
    context.linked[type].map(function (entity) {
      return stripLinks.call(_this, entity, type);
    });
  });

  if (inflect) {
    pluralizeLinked(context.linked);
  }

  object[key] = (context.ids.length === 1 && context.ids[0].length) ?
    context.entities[0] : context.entities;
  object.linked = context.linked;

  return stringify(object);
}
