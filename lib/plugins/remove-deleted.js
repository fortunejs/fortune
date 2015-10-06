var _ = require('lodash');

var hooks = [
  {
    name: 'removeDeleted',
    init: function(){
      return function(req){
        var _this = this;
        _.each( this, function( value, key ){
          if( key[0] === "_" && _.isArray( value ) ){
            console.log( key );
            console.log( 'Removing ' + key );
            delete _this[ key ];
          }
        });
        return this;
      }
    }
  }
];

exports.setup = function(app, resource){
  _.each( resource.schema, function( value, key ){
    if( _.isArray( value ) && _.isObject( value[0] ) ){
      var deletesArray = {};
      deletesArray[ "_" + key ] = value;
      _.extend( resource.schema, deletesArray );
    }
  });

  console.log( resource.schema );
  app.afterRead(hooks);
};

exports.hooks = hooks;
