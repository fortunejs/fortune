'use strict';

exports.peopleResetPassword = {
  name: 'reset-password',
  method: 'POST',
  config: {
    configHeader: 'set from init function'
  },
  init: function(options){
    return function(req, res){
      res.set('reset-password', req.body.password);
      res.set('reset-password-conf', options.configHeader);
      res.set('reset-password-resource', this.id);
      res.set('reset-password-nickname', this.nickname);

      res.send(200, 'ok');
    }
  }
};

exports.genericSendThrough = {
  name: 'send-through',
  method: 'GET',
  init: function(){
    return function(){
      return this;
    }
  }
};