var Joi = require('joi');
var request = require('supertest');
var should = require('should');
var Promise = require('bluebird');

var harvester = require('../lib/harvester.js');
var config = require('./config.js');
var JSONAPI_Error = require('../lib/jsonapi-error.js');
var seeder = require('./seeder.js');

describe('authorization', function () {

    var baseUrl = 'http://localhost:8004';
    var authorizationStrategy;
    var harvesterApp;
    before(function () {
        harvesterApp = harvester(config.harvester.options);

        harvesterApp.resource('categories', {
            name: Joi.string().required().description('a name')
        }).resource('products', {
                name: Joi.string().required().description('a name')
            }).get().disableAuthorization().register();

        harvesterApp.setAuthorizationStrategy(function () {
            return authorizationStrategy.apply(this, arguments);
        });

        harvesterApp.listen(8004);
    });

    beforeEach(function () {
        return seeder(harvesterApp).dropCollections('categories', 'products');
    });

    describe('when authorizationStrategy returns rejected promise', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return Promise.reject();
            }
        });
        it('should return 403 status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(403).end(done);
        });
        it('should return 200 status code and forward request to resource when authorization is disabled for that endpoint', function (done) {
            request(baseUrl).get('/products').expect('Content-Type', /json/).expect(200).end(done);
        });
    });

    describe('when authorizationStrategy returns custom JSONAPI_Error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return new JSONAPI_Error({status: 403});
            }
        });
        it('should return the same status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(403).end(done);
        });
    });

    describe('when authorizationStrategy throws error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return new Error;
            }
        });
        it('should return 500 status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(500).end(done);
        });
    });

    describe('when authorizationStrategy throws JSONAPI_Error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return new JSONAPI_Error({status: 403});
            }
        });
        it('should return the same status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(403).end(done);
        });
    });

    describe('when authorizationStrategy returns JSONAPI_Error promise', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return Promise.resolve(new JSONAPI_Error({status: 499}));
            }
        });
        it('should return the same status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(499).end(done);
        });
    });

    describe('when authorizationStrategy returns Error promise', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return Promise.resolve(new Error);
            }
        });
        it('should return the same status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(500).end(done);
        });
    });

    describe('when authorizationStrategy returns resolved promise', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return Promise.resolve();
            }
        });
        it('should return 200 status code and forward request to resource', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(200).end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                body.should.eql({categories: []});
                done();
            });
        });
    });

    describe('when authorizationStrategy returns JSONAPI_Error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                return new JSONAPI_Error({status: 444});
            }
        });
        it('should return status code of the JSONAPI_Error', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(444).end(done);
        });
    });

    describe('when authorizationStrategy throws JSONAPI_Error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                throw new JSONAPI_Error({status: 445});
            }
        });
        it('should return status code of the JSONAPI_Error', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(445).end(done);
        });
    });

    describe('when authorizationStrategy throws Error', function () {
        beforeEach(function () {
            authorizationStrategy = function () {
                throw new Error('A sample error');
            }
        });
        it('should return 500 status code', function (done) {
            request(baseUrl).get('/categories').expect('Content-Type', /json/).expect(500).end(done);
        });
    });

    describe('when authorization is disabled only for get resource collection and authorizationStrategy returns resolved promise only for POST product',
        function () {
            beforeEach(function () {
                authorizationStrategy = function (request, permission) {
                    if (permission === 'products.post') {
                        return Promise.resolve();
                    } else {
                        return Promise.reject();
                    }
                }
            });
            it('should return 200 status code on get collection and forward request to resource', function (done) {
                request(baseUrl).get('/products').expect('Content-Type', /json/).expect(200).end(function (error, response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    body.should.eql({products: []});
                    done();
                });
            });
            it('should return 403 status code on get single resource', function (done) {
                request(baseUrl).get('/products/1').expect('Content-Type', /json/).expect(403).end(done);
            });
            it('should return 201 status code on post single resource', function (done) {
                request(baseUrl).post('/products').send({products: [
                    {name: 'Pad'}
                ]}).expect('Content-Type', /json/).expect(201).end(done);
            });
        });
});
