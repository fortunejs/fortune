var RSVP = require('rsvp');
var chai = require('chai');
var _ = require('lodash');
var Joi = require('joi');
var chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.request.addPromises(RSVP.Promise);
var expect = chai.expect;

var should = require('should');
var request = require('supertest');
var Promise = RSVP.Promise;


var validation = require('../lib/validation');
var seeder = require('./seeder.js');

describe('validation', function () {

    describe('when validating a resource with missing schema', function () {
        it('should reject with error', function () {
            var request = {
                body: {
                    name: 'Obi wan Kenobi',
                    age: 55
                }
            };

            try {
                validation({}).validate(request);
                done(new Error('should fail'))
            } catch (e) {
            }

        });
    });

    describe('when validating a resource with missing request', function () {
        it('should reject with error', function () {
            var schema = {
                body: {
                    name: Joi.string().required().description('name'),
                    age: Joi.number().required().description('age')
                }
            };

            try {
                validation(schema).validate({});
                done(new Error('should fail'))
            } catch (e) {
            }
        });
    });

    describe('validation body', function () {

        var schema = {
            body: Joi.object().keys({
                stuff: Joi.array().items(Joi.object(
                    {
                        id: Joi.number().required().description('id'),
                        links: Joi.object(
                            {
                                foo: Joi.string().guid(),
                                bar: Joi.string().guid()
                            })
                    }
                ))
            })
        };

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    body: {
                        stuff: [
                            {
                                id: 121212,
                                links: {
                                    foo: 'bfebf5aa-e58b-410c-89e8-c3d8622bffdc',
                                    bar: '9ee7a0ec-8c06-4b0e-9a06-095b59fe815b'
                                }
                            }
                        ]
                    }
                };

                var details = validation(schema).validate(request);
                expect(details).to.be.empty;
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    body: {
                        stuff: [{
                            bla: 'blabla',
                            links: {
                                baz: 'bfebf5aa-e58b-410c-89e8-c3d8622bffdc',
                                bar: 'not a uuid'
                            }
                        }]
                    }
                };

                var details = validation(schema).validate(request);
                var bodyDetails = details.body;

                expect(bodyDetails).not.to.be.empty;

                expect(bodyDetails[0].path).to.equal('stuff.0.id');
                expect(bodyDetails[0].message).to.equal('"id" is required');

                expect(bodyDetails[1].path).to.equal('stuff.0.links.bar');
                expect(bodyDetails[1].message).to.equal('"bar" must be a valid GUID');

                expect(bodyDetails[2].path).to.equal('stuff.0.links');
                expect(bodyDetails[2].message).to.equal('"baz" is not allowed');

                expect(bodyDetails[3].path).to.equal('stuff.0');
                expect(bodyDetails[3].message).to.equal('"bla" is not allowed');

            });
        });

    });

    describe('validation query', function () {

        var schema = {query: {offset: Joi.number().required().description('offset')}};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    query: {offset: 1}
                };

                var details = validation(schema).validate(request);

                expect(details).to.be.empty;

            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    query: {x: 'a'}
                };

                var details = validation(schema).validate(request);
                var queryDetails = details.query;

                expect(queryDetails[0].path).to.equal('offset');
                expect(queryDetails[0].message).to.equal('"offset" is required');

            });
        });
    });

    describe('validation params', function () {

        var schema = {params: {id: Joi.number().required().description('id')}};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    params: {id: 121212}
                };

                var details = validation(schema).validate(request);

                expect(details).to.be.empty;

            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {params: {}};

                var details = validation(schema).validate(request);
                var paramsDetails = details.params;

                expect(paramsDetails[0].path).to.equal('id');
                expect(paramsDetails[0].message).to.equal('"id" is required');
            });
        });
    });

    describe('validation headers', function () {

        var schema = {headers: {Authorization: Joi.string().required().description('Authorization header')}};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    headers: {Authorization: 'Bearer abcdefghikjlm1234567'}
                };

                var details = validation(schema).validate(request);
                expect(details).to.be.empty;

            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {headers: {}};

                var details = validation(schema).validate(request)
                var headerDetails = details.headers;

                expect(headerDetails[0].path).to.equal('Authorization');
                expect(headerDetails[0].message).to.equal('"Authorization" is required');

            });
        });
    });

    describe('validation api calls', function () {

        var config, ids;
        beforeEach(function () {
            config = this.config;
            return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets').then(function (_ids) {
                ids = _ids;
            });
        });

        describe('when a resource is POSTed with a malformed payload', function () {
            it('should resolve with a 400 and errors in detail section', function (done) {

                var pet = {
                    name: 'Spot', foo: true
                }, pets = {pets: []};
                pets.pets.push(pet);

                request(config.baseUrl).post('/pets').send(pets)
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .expect(function (res) {
                        var error = JSON.parse(res.text).errors[0];
                        var bodyDetails = error.meta.details.body;

                        expect(error.detail).to.equal('validation failed on incoming request');

                        expect(bodyDetails[0].path).to.equal('pets.0.appearances');
                        expect(bodyDetails[0].message).to.equal('"appearances" is required');

                        expect(bodyDetails[1].path).to.equal('pets.0');
                        expect(bodyDetails[1].message).to.equal('"foo" is not allowed');
                    })
                    .end(function (err, res) {
                        if (err) return done(err);
                        done()
                    });
            });
        });

        describe('when a resource is PUT with a malformed payload', function () {
            it('should resolve with a 400 and errors in detail section', function (done) {

                var pet = {
                    name: 'Spot', foo: true
                }, pets = {pets: []};
                pets.pets.push(pet);

                request(config.baseUrl).put('/pets/' + ids.pets[0]).send(pets)
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .expect(function (res) {
                        var error = JSON.parse(res.text).errors[0];
                        var bodyDetails = error.meta.details.body;

                        expect(error.detail).to.equal('validation failed on incoming request');
                        expect(bodyDetails[0].path).to.equal('pets.0');
                        expect(bodyDetails[0].message).to.equal('"foo" is not allowed');
                    })
                    .end(function (err, res) {
                        if (err) return done(err);
                        done()
                    });
            });
        });
    });


});