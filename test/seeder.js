var _ = require('lodash');
var inflect = require('i')();
var request = require('supertest');
var Promise = require('bluebird');

var config = require('./config.js');
var fixtures = require('./fixtures');

/**
 * Configure seeding service.
 *
 * Sample usage:
 *
 * seed().seed('pets','people').then(function(ids){});
 * seed(harvesterInstance,'http://localhost:8001').seed('pets','people').then(function(ids){});
 *
 * @param harvesterInstance harvester instance that will be used to access database
 * @param baseUrl optional harvester's base url to post fixtures to
 * @returns {{dropCollectionsAndSeed: Function}} configured seeding service
 */
module.exports = function (harvesterInstance, baseUrl) {

    baseUrl = baseUrl || 'http://localhost:' + config.harvester.port;

    function post(key, value) {
        return new Promise(function (resolve, reject) {
            var body = {};
            body[key] = value;
            request(baseUrl).post('/' + key).send(body).expect('Content-Type', /json/).expect(201).end(function (error, response) {
                if (error) {
                    reject(error);
                    return;
                }
                var resources = JSON.parse(response.text)[key];
                var ids = {};
                ids[key] = [];
                _.forEach(resources, function (resource) {
                    ids[key].push(resource.id);
                });
                resolve(ids);
            });
        });
    }

    function drop(collectionName) {
        return new Promise(function (resolve, reject) {
            var collection = harvesterInstance.adapter.db.collections[collectionName];
            if (collection) {
                collection.drop(function () {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Drop collections whose names are specified in vararg manner.
     *
     * @returns {*} array of collection names
     */
    function dropCollections() {
        if (0 === arguments.length) {
            throw new Error('Collection names must be specified explicitly');
        }
        var collectionNames = 0 === arguments.length ? _.keys(fixtures()) : arguments;
        var promises = _.map(collectionNames, function (collectionName) {
            return drop(collectionName);
        });
        return Promise.all(promises).then(function () {
            return collectionNames;
        });
    }

    function dropCollectionsAndSeed() {
        return dropCollections.apply(this, arguments).then(function (collectionNames) {
            var allFixtures = fixtures();
            var promises = _.map(collectionNames, function (collectionName) {
                return post(collectionName, allFixtures[collectionName]);
            });
            return Promise.all(promises)
        }).then(function (result) {
                var response = {};
                _.forEach(result, function (item) {
                    _.extend(response, item);
                });
                return response;
            });
    }

    function seedCustomFixture(fixture) {
        var promises = _.map(fixture, function (items, collectionName) {
            return post(collectionName, items);
        });
        return Promise.all(promises)
    }

    if (null == harvesterInstance) {
        throw new Error('Harvester instance is required param');
    }

    return {
        dropCollections: dropCollections,
        dropCollectionsAndSeed: dropCollectionsAndSeed,
        seedCustomFixture: seedCustomFixture
    }
};
