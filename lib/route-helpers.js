'use strict';
var _ = require('lodash');

exports.squash = function(type, target, source){
  return _.reduce(Object.keys(source), function(memo, sourceKey){
    var sourceValue = source[sourceKey];
    var targetValue = target[sourceKey];
    var resultValue;
    switch(type){
      case '$pushAll':
      case '$pullAll':
        resultValue = targetValue ? targetValue.concat(sourceValue) : sourceValue;
        break;
      case '$set':
      case '$pull':
      case '$push':
        resultValue = sourceValue;
        break;
      default:
        throw new Error('Unknown operation ' + type);
    }
    memo[sourceKey] = resultValue;
    return memo;
  }, target);
};

exports.needsPositionalUpdate = function(parts, model){
  var fieldName = parts[0];
  var fieldSchema = model.schema.tree[ fieldName ];
  return _.isArray( fieldSchema ) &&
    _.isObject( fieldSchema[ 0 ] ) &&
    !_.has( fieldSchema[ 0 ], 'ref' );
};

exports.processReplaceOp = function(op, model){
  var field = op.path.split('/').slice(3);
  var value = op.value;
  var result = {
    match: {},
    separate: false,
    key: '$set',
    update: {}
  };
  var ret = [result];

  if (field.length > 1 && field[0] !== "links") {
    var needsPositionalUpdate = exports.needsPositionalUpdate(field, model);

    if (needsPositionalUpdate && /[0-9a-f]{24}/.test(field[1])){
      //happy to assume it's working one-level only for now
      var subdocid = field[1];
      var embeddedPath = field[0];
      result.match[embeddedPath + '._id'] = subdocid;
      result.separate = true;
      var updatePath = [embeddedPath, '$'].concat(field.slice(2)).join('.');
      result.update[updatePath] = value;

      //And add an op updating the possible deleted bit
      var forDeleted = {match: {}, separate: true, key: '$set', update: {}};
      forDeleted.match['_internal.deleted.'+embeddedPath + '._id'] = subdocid;
      forDeleted.update['_internal.deleted.'+ updatePath] = value;
      ret.push(forDeleted);
    }else{
      //regular update to deep path
      result.update[field.join(".")] = value;
    }
  } else {
    result.update[field[field.length-1]] = value;
  }
  return ret;
};

exports.processAddOp = function(op, model){
  var result = {
    match: {},
    separate: false,
    key: '$pushAll',
    update: {}
  };

  var field = op.path.split('/').splice(3);

  var tabFactor = field[field.length - 1] === "-" ? 2 : 1;
  if (field.length > 1 && field[0] !== "links") {
    var needsPositionalUpdate = exports.needsPositionalUpdate(field, model);

    if (needsPositionalUpdate && (field.length - tabFactor) > 1){
      var subdocid = field[1];
      var embeddedPath = field[0];
      result.match[embeddedPath + '._id'] = subdocid;
      result.separate = true;
      var updatePath = [embeddedPath, '$'].concat(
        tabFactor === 2 ? _.initial(field, field.length - 1).slice(2) : field.slice(2)
      ).join('.');
      result.update[updatePath] = result.update[updatePath] || [];
      result.update[updatePath].push(op.value);
    }else{
      var normalisedPath = (tabFactor === 2 ? _.initial(field, field.length - 1) : field).join('.');

      result.update[normalisedPath] = result.update[normalisedPath] || [];
      result.update[normalisedPath].push(op.value);
    }
  } else{
    result.update[field[field.length - tabFactor]] = result.update[field[field.length - tabFactor]] || [];
    result.update[field[field.length - tabFactor]].push(op.value);
  }

  return [result];
};

exports.processRemoveOp = function(op, model, returnedDocument){
  var field = op.path.split('/').slice(3);
  var value = field.pop()
    , fieldName, pullKey, fieldSchema, nestedObjects;

  if( field.length === 1 ){
    fieldName = field[ field.length - 1 ];
  }
  fieldSchema = model.schema.tree[ fieldName ];
  nestedObjects = _.isArray( fieldSchema ) &&
    _.isObject( fieldSchema[ 0 ] ) &&
    !_.has( fieldSchema[ 0 ], 'ref' );

  if( nestedObjects ){
    pullKey = '$pull';
  }
  else{
    pullKey = '$pullAll';
  }

  var result = {
    match: {},
    separate: false,
    key: pullKey,
    update: {}
  };
  var ret = [result];

  if (field.length > 1 && field[0] !== "links") {
    result.update[field.join(".")] = result.update[field.join(".")] || [];
    result.update[field.join(".")].push(value);
  }
  else{
    if( !nestedObjects ){
      result.update[field[field.length - 1]] = result.update[field[field.length - 1]] || [];
      result.update[field[field.length - 1]].push(value);
    }
    else{
      // create a $push and $pull queries for non-destructive deletes

      var pullOp = result;
      var pushOp = {
        match: {},
        separate: false,
        key: '$push',
        update: {}
      };
      ret.push(pushOp);
      pullOp.update[fieldName] = pullOp.update[fieldName] || { _id: { $in: [] } };
      pushOp.update[ "_internal.deleted." + fieldName ] = pushOp.update[ "_internal.deleted." + fieldName ] || {$each: []};

      var pullObj = pullOp.update[ fieldName ]._id;
      var pushObj = pushOp.update[ "_internal.deleted." + fieldName ];

      var idsToRemove, subdocsToRemove;

      subdocsToRemove = returnedDocument[ fieldName ]
        .filter( function( subdoc ){
          return subdoc._id.toString() === value;
        })
        .map( function( subdoc ){
          subdoc.deletedAt = new Date();
          return subdoc;
        });

      if( subdocsToRemove.length > 0 ){
        idsToRemove = subdocsToRemove
          .map( function( arg ){
              if( arg._id ){
                return arg._id;
              }
            }
          );
        pullObj.$in = pullObj.$in.concat( idsToRemove );
        pushObj.$each = pushObj.$each.concat( subdocsToRemove );
      }
    }
  }

  return ret;
};

exports.buildPatchOperations = function(model, returnedDocument, ops){
  var updates = [{
    match: {},
    update: {}
  }];

  ops.forEach(function (operation) {

    var preprocessed;
    switch(operation.op){
      case 'replace':
        preprocessed = exports.processReplaceOp(operation, model);
        break;
      case 'add':
        preprocessed = exports.processAddOp(operation, model);
        break;
      case 'remove':
        preprocessed = exports.processRemoveOp(operation, model, returnedDocument);
        break;
    }

    preprocessed.forEach(function(meta){
      var first = _.first(updates);
      if (meta.separate) {
        //split into two different update operations
        first = {match: {}, update: {}};
        updates.push(first);
      }
      _.extend(first.match, meta.match);
      first.update[meta.key] = first.update[meta.key] || {};
      exports.squash(meta.key, first.update[meta.key], meta.update);
    });
  });

  return updates;
};