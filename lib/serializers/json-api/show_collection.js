var inflection = require('inflection');
var stringify = require('./stringify');


module.exports = function (context, request, response) {
  var object = {};
  var inflect = !!this.options.inflect;
  var key = inflect ? inflection.pluralize(context.name) : context.name;

  object[key] = context.entities;

  return stringify(object);
};
