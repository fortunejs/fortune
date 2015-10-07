var lastModified = require('./last-modified');
var websockets = require('./websockets');
var removeDeleted = require('./remove-deleted');


exports.init = function(app, resource){
  lastModified.setup(app, resource);
  websockets.setup(app, resource);
  removeDeleted.setup(app, resource);
};
