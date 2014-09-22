var inflection = require('inflection');
var stringify = require('./stringify');


module.exports = function () {
  var object = {};
  var key;

  object.links = {};
  for (key in this.schemas) {
    if (!!this.options.inflect) {
      key = inflection.pluralize(key);
    }
    object.links[key] = [this.options.prefix, key, ''].join('/');
  }

  return stringify(object);
};
