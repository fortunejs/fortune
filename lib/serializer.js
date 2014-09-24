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


Serializer.prototype.mediaType = '';


Serializer.prototype.processQuery = proxy('processQuery');


Serializer.prototype.showIndex = proxy('showIndex');


Serializer.prototype.showCollection = proxy('showCollection');


Serializer.prototype.showErrors = proxy('showErrors');


function proxy (key) {
  return function (context) {
    return types[context.mediaType][key].apply(this, arguments);
  };
}
