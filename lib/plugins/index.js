var lastModified = require('./last-modified');
var websockets = require('./websockets');
var removeDeleted = require('./remove-deleted');

var plugins = [
  lastModified,
  websockets,
  removeDeleted
];

exports.init = function(app, resource){
  plugins.forEach(function(plugin){
    plugin.setup(app, resource);
  });
};

exports.add = function(plugin){
  plugins.push(plugin);
};