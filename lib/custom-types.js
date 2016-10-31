'use strict';
var RSVP = require('rsvp');
var _ = require('lodash');

exports.mapCustomTypes = function(schema, types){

  return _.reduce(Object.keys(schema), mapCustomTypes(schema), []);

  function mapCustomTypes(schema, prefix){
    return function(memo, key){
      if((typeof schema[key]).toLowerCase() === "string") {
        var customType = types[schema[key]];
        if(!customType) throw new Error("Custom Type \"" + schema[key] + "\" is not defined");
        memo.push({
          path: prefix ? [prefix, key].join('.') : key,
          hooks: customType.hooks,
          schema: customType.schema,
          typeId: schema[key],
          type: customType
        });
      } else if (
        typeof schema[key] === 'object' && //It's an embedded shema
        _.isArray(schema[key]) && //And IS an array
        _.isObject(schema[key][0]) && //With schema placed inside
        ! (
          schema[key][0].ref || //Which is not a reference configuration
          schema[key][0].type //Neither it is array of Strings for instance
        )
      ) {
        memo = memo.concat(_.reduce(Object.keys(schema[key][0]), mapCustomTypes(schema[key][0], prefix ? [prefix, key + '.0'].join('.') : key + '.0'), []));
      } else if (
        typeof schema[key] === 'object' && //It is an embedded schema
        !_.isArray(schema[key]) && //And not an array of embedded docs
        _.isObject(schema[key]) && //Don't remember why already, but this is required too
        !(schema[key].ref || schema[key].type) //And neither reference nor end path configuration
      ) {
        memo = memo.concat(_.reduce(Object.keys(schema[key]), mapCustomTypes(schema[key], prefix ? [prefix, key].join('.') : key), []));
      }
      return memo;
    }
  }
};

exports.rewriteSchema = function(schema, paths){
  paths.forEach(function(config){
    var parts = config.path.split('.');
    var head = _.initial(parts, parts.length - 1);
    var tail = _.last(config.path.split('.'));
    var branch = head.reduce(function(memo, part){
      return memo[part];
    }, schema);
    branch[tail] = config.schema;
  });
};

exports.docHasPath = function(doc, path){
  return !_.isUndefined(exports.getDocPath(doc, path));
};

exports.getDocPath = function(doc, path){
  return path.split('.').reduce(function(subdoc, part){
    return subdoc && !_.isUndefined(subdoc[part]) && subdoc[part];
  }, doc);
};

exports.setDocPath = function(doc, path, value){
  var parts = path.split('.');
  var head = _.initial(parts, parts.length - 1);
  var tail = _.last(parts);
  var branch = head.reduce(function(subdoc, part){
    return subdoc[part];
  }, doc);

  branch[tail] = value;
};

exports.applyHook = function(fn, path, doc, req, res){

  function applyToObject(subdoc, property, req, res){
    var ret = fn.call(subdoc[property], req, res);
    return (_.isFunction(ret.then) ? ret : RSVP.resolve(ret)).then(function(result) {
      subdoc[property] = result;
      return subdoc;
    });
  }

  var parts = path.split('.');

  var result = RSVP.resolve();
  var index = 0;
  var memo = doc;
  while (parts.length > 0) {
    var part = parts.shift();

    if (_.isArray(memo[part]) && parts.length > 0) {
      result = RSVP.all(memo[part].map(function(subdoc){
        //to drop the digit
        var tail = parts.concat([]).slice(1).join('.');
        return exports.applyHook(fn, tail, subdoc, req, res);
      }));
    } else if (_.isObject(memo[part]) && parts.length > 0){
      var tail = parts.concat([]).join('.');
      return exports.applyHook(fn, tail, memo[part], req, res);
    } else if (memo[part] && parts.length === 0) {
      result = applyToObject(memo, part, req, res);
    }

    index++;
  }

  return result;
};