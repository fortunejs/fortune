var _ = require('lodash');

var hooks = [
  {
    name: 'setLastModified',
    init: function(){
      return function(req){
        if (this.__isNew && !this.createdAt) this.createdAt = new Date();
        this.modifiedAt = new Date();
        return this;
      }
    }
  }
];

var ext = {
  modifiedAt: Date,
  createdAt: Date
};

exports.setup = function(app, resource){
  _.extend(resource.schema, ext);
  app.beforeWrite(hooks);
};

exports.hooks = hooks;
