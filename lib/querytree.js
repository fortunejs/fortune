var _ = require('lodash');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

//Fortune options will be stored here later
var adapter, resources, inflect;

/**
 * Query node constructor.
 * @param resource
 * @param query
 * @param [root]
 * @constructor
 */
function QueryNode(resource, query, root){
  this.isRoot = !!root;
  this.resource = resource;
  this.query = parseQuery(query, resource);
}


/**
 * Iterates first level of query detecting filtering by referenced resources fields
 * @param query
 * @param requestedResource
 */
function parseQuery(query, requestedResource){
  //If found linked resource - create new node
  var freeze = {};
  _.each(query, function(q, key){
    //find key in cached resources
    var schemaBranch = resources[requestedResource].schema[key];
    if (_.isObject(schemaBranch) && _.isObject(q)){
      //Three options: ref by array, ref by object, business PK, array field
      if (_.isArray(schemaBranch) && (!!schemaBranch[0].ref || _.isString(schemaBranch[0]))){
        //ref by array. Both types of declarations
        freeze[key] = createSubrequest(q, schemaBranch[0].ref || schemaBranch[0]);
      }else if (!!schemaBranch.ref){
        //ref by object
        freeze[key] = createSubrequest(q, schemaBranch.ref);
      }else{
        //Business PK in schema or an operator in query
        //Do nothing and skip this query to fetchIds without any change
        freeze[key] = q;
      }
    }else if (_.isString(schemaBranch) && _.isObject(q)){
      //String ref
      freeze[key] = createSubrequest(q, schemaBranch);
    }else{
      //Plain field
      //Do nothing. fetchIds should have this untouched
      freeze[key] = q;
    }
  });
  return RSVP.hash(freeze);
}

/**
 * Initiates new node and returns a promise
 * @param subQuery
 * @param toResource
 */
function createSubrequest(subQuery, toResource){
  var node = new QueryNode(toResource, subQuery);
  return node.query.then(function(result){
    return fetchIds(node.resource, result);
  });
}

/**
 * Converts bottom-level query to {$in: [ids]}
 * @param resource
 * @param query
 * @returns {*}
 */
function fetchIds(resource, query){
  return adapter.findMany(resource, query, {select: ['id'], limit: 0})
    .then(function(resources){
      return {
        $in: _.pluck(resources, 'id')
      };
    });
}

/**
 * registers fortune instance
 * expects that all resources have been defined
 */
exports.use = function(fortune){
  adapter = fortune.adapter;
  resources = fortune._resources;
  inflect = fortune.inflect;
};

exports.parse = function(resourceName, query){
  var rootNode = new QueryNode(inflect.singularize(resourceName), query, true);
  return rootNode.query;
};

//Some testing helpers
exports._QueryNode = QueryNode;
