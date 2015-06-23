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

            return validation.validate(request, {})
                .catch(function (errors) {
                    errors.should.equal('Please provide a validation schema');
                })
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

            return validation.validate('', schema)
                .catch(function (errors) {
                    errors.should.equal('Please provide a request to validate');
                });
        });
    });

    describe('validation body', function () {

        var schema = Joi.object().keys({
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
        });

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

                return validation.validate(request, schema)
                    .then(function (errors) {
                        expect(errors).to.be.empty;
                    });
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

                return validation.validate(request, schema, {}, {}, {})
                    .then(function (errors) {
                        expect(errors[0].field).to.equal('stuff.0.id');
                        expect(errors[0].location).to.equal('body');
                        expect(errors[0].messages[0]).to.equal('"id" is required');

                        expect(errors[1].field).to.equal('stuff.0.links.bar');
                        expect(errors[1].location).to.equal('body');
                        expect(errors[1].messages[0]).to.equal('"bar" must be a valid GUID');

                        expect(errors[2].field).to.equal('stuff.0.links');
                        expect(errors[2].location).to.equal('body');
                        expect(errors[2].messages[0]).to.equal('"baz" is not allowed');

                        expect(errors[3].field).to.equal('stuff.0');
                        expect(errors[3].location).to.equal('body');
                        expect(errors[3].messages[0]).to.equal('"bla" is not allowed');
                    });
            });
        });

    });

    describe('validation query', function () {

        var schema = {offset: Joi.number().required().description('offset')};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    query: {offset: 1}
                };


                return validation.validate(request, {}, schema, {}, {})
                    .then(function (errors) {
                        expect(errors).to.be.empty;
                    });

            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    query: {x: 'a'}
                };

                return validation.validate(request, {}, schema, {}, {})
                    .then(function (errors) {
                        expect(errors[0].field).to.equal('offset');
                        expect(errors[0].location).to.equal('query');
                        expect(errors[0].messages[0]).to.equal('"offset" is required');
                    });
            });
        });
    });

    describe('validation params', function () {

        var schema = {id: Joi.number().required().description('id')};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    params: {id: 121212}
                };

                return validation.validate(request, {}, {}, schema, {})
                    .then(function (errors) {
                        expect(errors).to.be.empty;
                    });
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {params: {}};

                return validation.validate(request, {}, {}, schema, {})
                    .then(function (errors) {
                        expect(errors[0].field).to.equal('id');
                        expect(errors[0].location).to.equal('params');
                        expect(errors[0].messages[0]).to.equal('"id" is required');
                    });
            });
        });
    });

    describe('validation headers', function () {

        var schema = {Authorization: Joi.string().required().description('Authorization header')};

        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    headers: {Authorization: 'Bearer abcdefghikjlm1234567'}
                };

                return validation.validate(request, {}, {}, {}, schema)
                    .then(function (errors) {
                        expect(errors).to.be.empty;
                    });

            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {headers: {}};

                return validation.validate(request, {}, {}, {}, schema)
                    .then(function (errors) {
                        expect(errors[0].field).to.equal('Authorization');
                        expect(errors[0].location).to.equal('headers');
                        expect(errors[0].messages[0]).to.equal('"Authorization" is required');
                    });

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
            it('should resolve with a 422 and errors in detail section', function (done) {

                var pet = {
                    name: 'Spot', foo: true
                }, pets = {pets: []};
                pets.pets.push(pet);

                request(config.baseUrl).post('/pets').send(pets)
                    .expect('Content-Type', /json/)
                    .expect(422)
                    .expect(function (res) {
                        var causes = JSON.parse(res.text).errors[0].meta.causes;
                        expect(causes[0].field).to.equal('pets.0.appearances');
                        expect(causes[0].location).to.equal('body');
                        expect(causes[0].messages[0]).to.equal('"appearances" is required');

                        expect(causes[1].field).to.equal('pets.0');
                        expect(causes[1].location).to.equal('body');
                        expect(causes[1].messages[0]).to.equal('"foo" is not allowed');
                    })
                    .end(function (err, res) {
                        if (err) return done(err);
                        done()
                    });
            });
        });

        describe('when a resource is PUT with a malformed payload', function () {
            it('should resolve with a 422 and errors in detail section', function (done) {

                var pet = {
                    name: 'Spot', foo: true
                }, pets = {pets: []};
                pets.pets.push(pet);

                request(config.baseUrl).put('/pets/'+ids.pets[0]).send(pets)
                    .expect('Content-Type', /json/)
                    .expect(422)
                    .expect(function (res) {
                        var causes = JSON.parse(res.text).errors[0].meta.causes;

                        expect(causes[0].field).to.equal('pets.0');
                        expect(causes[0].location).to.equal('body');
                        expect(causes[0].messages[0]).to.equal('"foo" is not allowed');
                    })
                    .end(function (err, res) {
                        if (err) return done(err);
                        done()
                    });
            });
        });
    });





});