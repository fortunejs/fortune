var types;


module.exports = Serializer;


/**
 * Serializer is an object containing methods to be implemented.
 */
function Serializer (context) {
  var _this = this;
  var serializers = context.options.serializer;
  types = this.types = {};

  if (!Array.isArray(serializers)) {
    serializers = [serializers];
  }

  serializers.forEach(function (serializer) {
    var key;
    var type;

    if (typeof serializer === 'string') {
      try {
        serializer = require('./serializers/' + serializer + '/');
      } catch (error) {
        serializer = require(serializer);
      }
    }

    type = _this.types[serializer.mediaType] = {};

    for (key in Object.getPrototypeOf(_this)) {
      if (serializer.hasOwnProperty(key) && key !== 'mediaType') {
        type[key] = serializer[key];
      }
    }

  });
}


/**
 * Each serializer must correspond to a specific media type.
 */
Serializer.prototype.mediaType = '';


/**
 * In order for the serializer to be aware of query strings, this
 * method is provided.
 */
Serializer.prototype.processQuery = proxy('processQuery');


/**
 * Show the top-level index.
 */
Serializer.prototype.showIndex = proxy('showIndex');


/**
 * Represent an entity or entities as a resource.
 */
Serializer.prototype.showResource = proxy('showResource');


/**
 * Show errors.
 */
Serializer.prototype.showErrors = proxy('showErrors');


/*!
 * Each method gets called with the arguments: `context`, `request`, `response`
 */
function proxy (key) {
  return function (context) {
    return types[context.mediaType][key].apply(this, arguments);
  };
}
