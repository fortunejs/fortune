var inflection = require('inflection');
var stringify = require('./stringify');


module.exports = function (context, request, response) {
  var object = {};
  var inflect = !!this.options.inflect;
  var key = inflect ? inflection.pluralize(context.type) : context.type;

  object[key] = context.entities;
  object.linked = context.linked;

  return stringify(object);
};
