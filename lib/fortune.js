// local modules
var schemaParser = require('./schemas/parser');


module.exports = function (options) {
  return new Fortune(options);
};


/**
 * Fortune object.
 *
 * @param {Object} options
 */
function Fortune () {
  this.init.apply(this, arguments);
}


/*!
 * Init method.
 *
 * @param {Object} options
 */
Fortune.prototype.init = function (options) {
  this.options = setDefaults(options);
  this.schemas = {};
};


/**
 * Define a resource.
 *
 * @param {String} name name of the resource
 * @param {Object} schema schema object
 * @param {Object} [options] additional options
 * @return this
 */
Fortune.prototype.resource = function (name) {
  var schemas = this.schemas;

  this._currentResource = name;

  if (!schemas.hasOwnProperty(name)) {
    schemas[name] = schemaParser.apply(null, arguments);
  } else {
    console.warn('The resource "' + name + '" was already defined.');
  }

  return this;
};


/*!
 * Default settings.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options) {
  var defaults = {

  };
  var key;

  for (key in options) {
    defaults[key] = options[key];
  }

  return defaults;
}
