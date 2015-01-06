var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('./../fixtures.json');

module.exports = function(baseUrl,keys,ids) {
    describe('resources', function () {

        describe('getting a list of resources', function () {
            _.each(fixtures, function (resources, collection) {
                var key = keys[collection];

                it('in collection "' + key + '"', function (done) {
                    request(baseUrl)
                        .get('/' + key)
                        .expect('Content-Type', /json/)
                        .expect(200)
                        .end(function (error, response) {
                            should.not.exist(error);
                            var body = JSON.parse(response.text);
                            ids[key].forEach(function (id) {
                                _.contains(_.pluck(body[key], 'id'), id).should.equal(true);
                            });
                            done();
                        });
                });
            });
        });

        describe('getting each individual resource', function () {
            _.each(fixtures, function (resources, collection) {
                var key = keys[collection];

                it('in collection "' + key + '"', function (done) {
                    RSVP.all(ids[key].map(function (id) {
                        return new Promise(function (resolve) {
                            request(baseUrl)
                                .get('/' + key + '/' + id)
                                .expect('Content-Type', /json/)
                                .expect(200)
                                .end(function (error, response) {
                                    should.not.exist(error);
                                    var body = JSON.parse(response.text);
                                    body[key].forEach(function (resource) {
                                        (resource.id).should.equal(id);
                                    });
                                    resolve();
                                });
                        });
                    })).then(function () {
                        done();
                    });
                });
            });
        });
    });
}