var _ = require('lodash');

var hooks = [
  {
    name: 'removeDeleted',
    init: function(){
      return function(req){

        var _this = this;

        if( this.internal ){
          if( req.query.includeDeleted ){
            _.each( this.internal.deleted, function( deletedDocs, fieldName ){
              if( _this[ fieldName ] ){
                _this[ fieldName ] = _this[ fieldName ].concat( deletedDocs );
              }
            });
          }
          delete this.internal;
        }
        return this;
      }
    }
  }
];

exports.setup = function(app, resource){
  resource.schema.internal = {};
  _.each( resource.schema, function( value, key ){
    if( _.isArray( value ) && _.isObject( value[0] ) && !_.has( value[0], 'ref' ) ){
      var internalArray = { deleted: {} };
      internalArray.deleted[ key ] = [ _.extend( value[ 0 ], { deletedAt: Date } ) ];
      _.extend( resource.schema.internal, internalArray );
    }
  });
  app.afterRead(hooks);
  app.afterWrite(hooks);
};

exports.hooks = hooks;
