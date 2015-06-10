var RSVP = require('rsvp');
var chai = require('chai');
var _ = require('lodash');
var Joi = require('joi');
var chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.request.addPromises(RSVP.Promise);
var expect = chai.expect;

var Validation = require('../../lib/validation');

describe('validation', function(){
    describe('when validating a resource with missing schema', function () {
        it('should reject with error', function () {
            var request = {
                body: {
                    name: 'Obi wan Kenobi',
                    age: 55
                }
            }

            return Validation.validate(request, {})
                .catch(function(errors) {
                    errors.should.equal('Please provide a validation schema');
                })
        });
    });

    describe('when validating a resource with missing request', function () {
        it('should reject with error', function () {
            var schema = {
                name: Joi.string().required().description('name'),
                age: Joi.number().required().description('age')
            }

            return Validation.validate('', schema)
                .catch(function(errors) {
                    errors.should.equal('Please provide a request to validate');
                });
        });
    });

    describe('validation body', function () {
        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    body: { stuff: [{id: 121212}] }
                }

                var schema = {
                    id: Joi.number().required().description('id')
                }

                return Validation.validate(request, schema)
                    .then(function(errors) {
                        expect(errors).to.be.empty;
                });
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    body: { stuff: [{}] }
                }

                var schema = { id: Joi.number().required().description('id') };

                return Validation.validate(request, schema, {}, {}, {})
                    .then(function(errors) {
                        expect(errors[0].field).to.equal('stuff.0.id');
                        expect(errors[0].location).to.equal('body');
                        expect(errors[0].messages[0]).to.equal('"id" is required');
                    });
            });
        });
    });

    describe('validation query', function () {
        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    query: { pg: 1 }
                }

                var schema = { pg: Joi.number().required().description('pg') };

                return Validation.validate(request, {}, schema, {}, {})
                    .then(function(errors) {
                        expect(errors).to.be.empty;
                    });
                
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    query: { x: 'a' }
                }

                var schema = { pg: Joi.number().required().description('pg') };

                return Validation.validate(request, {}, schema, {}, {})
                    .then(function(errors) {
                        expect(errors[0].field).to.equal('pg');
                        expect(errors[0].location).to.equal('query');
                        expect(errors[0].messages[0]).to.equal('"pg" is required');
                    });
            });
        });
    });

    describe('validation params', function () {
        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    params: { id: 121212 }
                }

                var schema = { id: Joi.number().required().description('id') };

                return Validation.validate(request, {}, {}, schema, {})
                    .then(function(errors) {
                        expect(errors).to.be.empty;
                });
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = { params : {} };

                var schema = { id: Joi.number().required().description('id') };

                return Validation.validate(request, {}, {}, schema, {})
                    .then(function(errors) {
                        expect(errors[0].field).to.equal('id');
                        expect(errors[0].location).to.equal('params');
                        expect(errors[0].messages[0]).to.equal('"id" is required');
                    });
            });
        });
    });

    describe('validation headers', function () {
        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    headers: { token: 121212 }
                }

                var schema = { token: Joi.number().required().description('token') };

                return Validation.validate(request, {}, {}, {}, schema)
                    .then(function(errors) {
                        expect(errors).to.be.empty;
                    });
                
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = { headers : {} };

                var schema = { token: Joi.number().required().description('token') };

                return Validation.validate(request, {}, {}, {}, schema)
                    .then(function(errors) {
                        expect(errors[0].field).to.equal('token');
                        expect(errors[0].location).to.equal('headers');
                        expect(errors[0].messages[0]).to.equal('"token" is required');
                    });

            });
        });
    });

    describe('validation all', function () {
        describe('when validating a valid resource', function () {
            it('should resolve', function () {
                var request = {
                    headers: { token: 121212 },
                    body: { stuff: [{ age: 55 }] },
                    query: { pg: 1 },
                    params: { id: 121212 }
                }

                var schema = {
                    body: { age: Joi.number().required().description('age') },
                    query: { pg: Joi.number().required().description('pg') },
                    params: { id: Joi.number().required().description('id') },
                    headers: { token: Joi.number().required().description('token') }
                }

                return Validation.validate(request, schema.body, schema.query, schema.params, schema.headers)
                    .then(function(errors) {
                        expect(errors).to.be.empty;
                    });
                
            });
        });

        describe('when validating an invalid resource', function () {
            it('should resolve with errors', function () {
                var request = {
                    headers: { },
                    body: { stuff: [{}] },
                    query: { },
                    params: { }
                }

                var schema = {
                    body: { name: Joi.number().required().description('name') },
                    query: { pg: Joi.number().required().description('pg') },
                    params: { id: Joi.number().required().description('id') },
                    headers: { token: Joi.number().required().description('token') }
                }

                return Validation.validate(request, schema.body, schema.query, schema.params, schema.headers)
                    .then(function(errors) {
                        expect(errors[0].field).to.equal('stuff.0.name');
                        expect(errors[0].location).to.equal('body');
                        expect(errors[0].messages[0]).to.equal('"name" is required');

                        expect(errors[1].field).to.equal('id');
                        expect(errors[1].location).to.equal('params');
                        expect(errors[1].messages[0]).to.equal('"id" is required');

                        expect(errors[2].field).to.equal('pg');
                        expect(errors[2].location).to.equal('query');
                        expect(errors[2].messages[0]).to.equal('"pg" is required');

                        expect(errors[3].field).to.equal('token');
                        expect(errors[3].location).to.equal('headers');
                        expect(errors[3].messages[0]).to.equal('"token" is required');
                    });
                
            });
        });
    });
});