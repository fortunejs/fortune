var lastModified = require('./last-modified');

exports.init = function(app, resource){
  lastModified.setup(app, resource);
};
