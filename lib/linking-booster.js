var RSVP = require('rsvp');
var _ = require('lodash');

exports.init = function(director, inflect, resources){
  var refsHash = {};
  var ops = {};


  //Build refs hash for quick links retrieval
  _.each(resources, function(resource, resourceName){
    _.each(resource.schema, function(metadata, fieldName){
      var meta = _.isArray(metadata) ? metadata[0] : metadata;
      if (meta.ref && !meta.external){
        refsHash[inflect.pluralize(resourceName) + '.' + fieldName] = {resource: inflect.pluralize(meta.ref), field: meta.inverse};
      }
    });
  });

  ops.canBoost = function(req){
    var parts = req.path.split('/');
    return parts.length === 3 &&
      parts[2].length !== 0 &&
      !!req.query.include;
  };

  ops.restoreRequest = function(req){
    req.query.include = req.originalIncludes.join(',');
  };

  ops.dropBoostedIncludes = function(req, boosted){

  };

  ops.groupIncludes = function(req, includes){
    //This should return instructions for fetchByFilter
    var root = req.path.split('/')[1];
    var id = req.path.split('/')[2];
    req.originalIncludes = _.clone(includes);
    var instructions = {};

    includes = _.compact(_.map(includes, function(include){
      var parts = include.split('.');
      var includeParent = parts[0];

      var link = refsHash[root + '.' + includeParent];
      if (link){
        //It's not external and has valid ref
        if (link.field){
          //It has inverse reference thus can be filtered
          var query = {};
          query[link.field] = {$in: [id]};
          instructions[link.resource] = instructions[link.resource] || {};
          instructions[link.resource].filter = query;
          instructions[link.resource].include = instructions[link.resource].include || [];
          instructions[link.resource].include.push(_.rest(parts));
          return null;
        }
      }
      return include;
    }));

    req.query.include = includes.join(',');
    return instructions;
  };

  ops.startLinking = function(req){
    if (!req.query || !req.query.include) return RSVP.resolve();

    var groups = ops.groupIncludes(req, parseIncludes(req));

    return RSVP.all(_.map(groups, function(requestOptions, resourceName){
      return director.methods.get(resourceName, {
        filter: requestOptions.filter,
        include: _.compact(_.map(requestOptions.include, function(i){ return i.join('.')})).join(',')
      });
    }));

  };

  ops.mergeResults = function(req, linker, body){
    var root = req.path.split('/')[1];
    return linker.then(function(linked){
      _.each(linked, function(linkedData){
        var anc = getAncestorName(linkedData);
        body.links = body.links || {};
        body.linked = body.linked || {};
        body.links[root + '.' + anc] = {
          type: anc
        };
        body.linked[anc] = linkedData[anc];
      });
      return body;
    });
  };

  return ops;

  function parseIncludes(req){
    return req.query.include.split(',');
  }

  function getAncestorName(obj){
    return Object.keys(_.omit(obj, 'links', 'linked'))[0];
  }
};