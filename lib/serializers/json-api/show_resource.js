var inflection = require('inflection');
var stringify = require('./stringify');
var linkify = require('./linkify');
var pluralizeLinked = require('./pluralize_linked');
var showLinks = require('./show_links');


module.exports = showResource;


function showResource (context) {
  var _this = this;
  var object = {};
  var inflect = !!this.options.inflect;
  var key = inflect ? inflection.pluralize(context.type) : context.type;
  var links;


  // wrap links in an object
  context.entities.map(function (entity) {
    return linkify.call(_this, entity, context.type, true);
  });

  Object.keys(context.linked).forEach(function (type) {
    context.linked[type].map(function (entity) {
      return linkify.call(_this, entity, type, true);
    });
  });


  // assign key/values on returned object
  links = showLinks.call(this, context);
  if (Object.keys(links).length) {
    object.links = links;
  }

  object[key] = (!!context.ids && context.ids.length === 1 && context.ids[0].length) ?
    context.entities[0] : context.entities;

  if (Object.keys(context.linked).length) {
    object.linked = context.linked;
    if (inflect) {
      pluralizeLinked(object.linked);
    }
  }


  return stringify(object);
}
