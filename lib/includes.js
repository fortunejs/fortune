
var RSVP = require('rsvp'),
    Promise = RSVP.Promise,
    _ = require('lodash'),
    inflect = require('i')(),
    $http = require('http-as-promised');

module.exports = function (adapter, schemas) {

    function linked(body, inclusions) {

        var primaryResourceName = extractPrimaryResource(body);
        // a bit dirty, but necessary to avoid total refactor of sendResponse
        function extractPrimaryResource(body) {
            return _.first(_.filter(_.keys(body), function (key) {
                return !(key === 'meta' || key === 'links');
            }));
        }

        var modelName = inflect.singularize(primaryResourceName);
        var primarySchema = schemas[modelName];

        var inclusionTree = _.chain(inclusions)
            .map(function (inclusion) {
                var inclusionTokens = inclusion.split('.');
                return buildInclusionBranch(inclusionTokens, primarySchema);
            })
            .reduce(function (acc, branch) {
                return _.merge(acc, branch);
            })
            .value();

        // builds a tree representation out of a series of inclusion tokens
        function buildInclusionBranch(inclusionTokens, schema) {

            var inclusionToken = _.first(inclusionTokens);
            var type = _.isArray(schema[inclusionToken]) ? schema[inclusionToken][0] : schema[inclusionToken];
            var normalisedType = _.isPlainObject(type) ? type.ref : type;

            var linkDescriptor = {
                def: {type: normalisedType}
            };

            var baseUri = _.isPlainObject(type) ? type.baseUri : null;
            if (baseUri) {
                var remoteIncludes = _.drop(inclusionTokens, _.indexOf(inclusionTokens, inclusionToken) + 1).join('.');
                var remoteDescriptor = _.merge(linkDescriptor, {
                        def: {baseUri: baseUri, remoteIncludes: remoteIncludes}
                    }
                );
                return setRefs(remoteDescriptor);
            } else {
                var tokensRemaining = _.drop(inclusionTokens);
                if (tokensRemaining.length == 0) {
                    return setRefs(linkDescriptor);
                } else {
                    return _.merge(linkDescriptor, buildInclusionBranch(tokensRemaining, schemas[normalisedType]));
                }
            }

            function setRefs(descriptor) {
                return _.set({}, 'refs.' + inclusionToken, descriptor);
            }

        }

        var resources = body[primaryResourceName];
        return fetchLinked({}, resources, inclusionTree)
            .then(function (linked) {
                return _.merge(body, linked);
            });

    }

    function fetchLinked(fetchedIds, resources, inclusionBranch) {
        return RSVP
            .all(_.map(_.keys(inclusionBranch ? inclusionBranch.refs : []), function (inclusionRefKey) {
                return fetchResources(fetchedIds, resources, inclusionBranch, inclusionRefKey)
                    .then(function (result) {
                        if (result) {
                            // process all entries as one of the inclusionBranch descriptor might have had a remoteInclude property set
                            // which will yield more reslts than 'inclusionRefKey' only
                            var mergedLinkedResources = _.reduce(result, function (acc, linkedResources, linkedResName) {
                                var concatExisting = _.merge(linkedResources, acc.linked[linkedResName]);
                                return _.set(acc, 'linked.' + [linkedResName], concatExisting)

                            }, {linked: {}});
                            // recur and fetch the linked resources for the next inclusionBranch
                            return _.merge(mergedLinkedResources,
                                fetchLinked(fetchedIds, mergedLinkedResources[inclusionRefKey], inclusionBranch[inclusionRefKey]))
                        } else {
                            return {};
                        }
                    });
            }))
            .then(function (linkedResources) {
                return _.reduce(linkedResources, function(acc, linkedResource) {
                    return _.merge(acc, linkedResource);
                })
            });
    }

    function fetchResources(fetchedIds, resources, inclusionBranch, inclusionRefKey) {
        var linkedIds = getLinkedIds(resources, inclusionRefKey);
        if (linkedIds && linkedIds.length > 0) {

            var inclusionDescriptor = inclusionBranch.refs[inclusionRefKey];
            var type = inclusionDescriptor.def.type;

            fetchedIds[type] = fetchedIds[type] || [];
            var remainingIds = _.without(linkedIds, fetchedIds[type]);
            fetchedIds[type] = fetchedIds[type].concat(remainingIds);

            var resourceName = inflect.pluralize(type);

            if (!inclusionDescriptor.def.baseUri) {

                return adapter.findMany(type, remainingIds)
                    // todo re-add aftertransform
                    .then(function (resources) {
                        return _.set({}, resourceName, resources);
                    });

            } else {
                // the related resource is defined on another domain
                // fetch with an http call with inclusion of the deep linked resources for this resource
                return $http(inclusionDescriptor.def.baseUri + '/' + resourceName + '?id=' + remainingIds.join(',') +
                    '&include=' + inclusionDescriptor.def.remoteIncludes, {json: true})
                    .spread(function (response, body) {
                        // get results for the primary resource
                        var primary = _.set({}, resourceName, body[resourceName]);
                        return _.reduce(body.linked, function (accum, val, key) {
                            // accumulate results for the linked resources
                            return _.set(accum, key, val);
                        }, primary);
                    });
            }

        } else {
            return new Promise(function(resolve,reject){
                resolve();
            });
        }
    }

    function getLinkedIds(resources, path) {
        return _.reduce(resources, function (acc, resource) {
            if (resource.links && resource.links[path]) {
                var id = resource.links[path];
                if (_.isArray(id)) {
                    return _.union(acc, id);
                } else {
                    return _.union(acc, [id]);
                }
            }
        }, []);
    }


    return {
        linked: linked
    }

};