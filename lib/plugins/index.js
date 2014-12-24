var lastModified = require('./last-modified');
var websockets = require('./websockets');


exports.init = function(app, resource){
  lastModified.setup(app, resource);
  websockets.setup(app, resource);
};
