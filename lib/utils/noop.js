var Promise = require('promise');

// Basically do nothing but return a resolved promise.
module.exports = function () {
  return Promise.resolve();
};
