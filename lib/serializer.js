module.exports = Serializer;


/**
 * Serializer is an object containing methods to be implemented.
 */
function Serializer (context) {
  var serializer = context.options.serializer;
  var key;

  if (typeof serializer === 'string') {
    try {
      serializer = require('./serializers/' + serializer + '/');
    } catch (error) {
      serializer = require(serializer);
    }
  }

  for (key in Object.getPrototypeOf(this)) {
    if (serializer.hasOwnProperty(key)) {
      this[key] = serializer[key];
    }
  }

  this.init.call(context);
}


Serializer.prototype.init = noop;


Serializer.prototype.showIndex = noop;


Serializer.prototype.showCollection = noop;


function noop () {
  return '';
}
