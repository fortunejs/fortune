var inflection = require('inflection');


module.exports = showLinks;


function showLinks (context) {
  var _this = this;
  var schemas = this.schemas;
  var links = {};
  var types = [context.type];

  Object.keys(context.linked).forEach(function (type) {
    if (!~types.indexOf(type)) types.push(type);
  });

  types.forEach(function (schemaType) {

    // get the links of each type
    Object.keys(schemas[schemaType]).forEach(function (key) {
      var type = schemaType;
      var link = schemas[type][key].link;

      if (!!_this.options.inflect) {
        type = inflection.pluralize(type);
        if (!!link) link = inflection.pluralize(link);
      }

      if (!!link) {
        links[[type, key].join('.')] = {
          href: [_this.options.prefix, link, '{' + type + '.' + key + '}'].join('/'),
          type: link
        };
      }
    });

  });

  return links;
}
