var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var seeder = require('./seeder.js');


describe('jsonapi error handling', function () {

    var config;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets');
    });

    describe('raise a JSONAPI_Error error in foobar before callback', function () {
        it('should respond with a 400 and content-type set to application/vnd.api+json', function (done) {
            request(config.baseUrl).post('/foobars').send({foobars: [
                {foo: 'bar'}
            ]}).expect('Content-Type', 'application/vnd.api+json; charset=utf-8').expect(400).end(function (error, response) {
                    var body = JSON.parse(response.text);
                    should.exist(body.errors[0].status);
                    body.errors[0].status.should.equal(400);
                    should.exist(body.errors[0].title);
                    body.errors[0].title.should.equal('Request was malformed.');
                    should.exist(body.errors[0].detail);
                    body.errors[0].detail.should.equal('Foo was bar');
                    done();
                });
        });
    });

    describe('return a promise which rejects with a JSONAPI_Error in foobar before callback', function () {
        it('should respond with a 400 and content-type set to application/vnd.api+json', function (done) {
            request(config.baseUrl).post('/foobars').send({foobars: [
                {foo: 'baz'}
            ]}).expect('Content-Type', 'application/vnd.api+json; charset=utf-8').expect(400).end(function (error, response) {
                    var body = JSON.parse(response.text);
                    should.exist(body.errors[0].status);
                    body.errors[0].status.should.equal(400);
                    should.exist(body.errors[0].title);
                    body.errors[0].title.should.equal('Request was malformed.');
                    should.exist(body.errors[0].detail);
                    body.errors[0].detail.should.equal('Foo was baz');
                    done();
                });
        });
    });

    describe('bulk insert 2 entities into /foobars resource, each before callback rejects with an JSONAPI_Error', function () {
        it('should respond with a 400, content-type set to application/vnd.api+json and the errors object carries the first error encountered',
            function (done) {
                request(config.baseUrl).post('/foobars').send({foobars: [
                    {foo: 'bar'},
                    {foo: 'baz'}
                ]}).expect('Content-Type', 'application/vnd.api+json; charset=utf-8').expect(400).end(function (error, response) {
                        var body = JSON.parse(response.text);
                        should.exist(body.errors[0].status);
                        body.errors[0].status.should.equal(400);
                        should.exist(body.errors[0].title);
                        body.errors[0].title.should.equal('Request was malformed.');
                        should.exist(body.errors[0].detail);
                        done();
                    });
            });
    });

    describe('raise random error in the express req/res chain', function () {
        it('should respond with a 500 error and content-type set to application/vnd.api+json', function (done) {
            request(config.baseUrl).get('/random-error').expect('Content-Type', 'application/vnd.api+json; charset=utf-8').expect(500).end(function (error,
                                                                                                                                                     response) {
                var body = JSON.parse(response.text);
                should.exist(body.errors[0].status);
                body.errors[0].status.should.equal(500);
                should.exist(body.errors[0].title);
                body.errors[0].title.should.equal('Oops, something went wrong.');
                should.exist(body.errors[0].detail);
                body.errors[0].detail.should.equal('Error: this is an error');
                done();
            });
        });
    });

    describe('raise JSONAPI_Error with 400 status code in the express the req/res chain', function () {
        it('should respond with a 400 error and content-type set to application/vnd.api+json', function (done) {
            request(config.baseUrl).get('/json-errors-error').expect('Content-Type', 'application/vnd.api+json; charset=utf-8').expect(400).end(function (error,
                                                                                                                                                          response) {
                var body = JSON.parse(response.text);
                should.exist(body.errors[0].status);
                body.errors[0].status.should.equal(400);
                should.exist(body.errors[0].title);
                body.errors[0].title.should.equal('Request was malformed.');
                should.exist(body.errors[0].detail);
                body.errors[0].detail.should.equal('Bar was not foo');
                done();
            });
        });
    });
});
