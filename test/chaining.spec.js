var should = require('should');
var Joi = require('joi');

var seeder = require('./seeder.js');

describe('chaining', function () {

    var config;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets')
    });

    describe('resource returns chainable functions', function () {
        it('should return httpMethods on last resource', function (done) {
            var plant = this.harvesterApp.resource('plant', {
                name: Joi.string().required().description('name'),
                appearances: Joi.string().required().description('appearances'),
                links: {
                    pets: ['pet'],
                    soulmate: {ref: 'person', inverse: 'soulmate'},
                    lovers: [
                        {ref: 'person', inverse: 'lovers'}
                    ]
                }
            });

            ['get', 'post', 'put', 'delete', 'patch', 'getById', 'putById', 'deleteById', 'patchById', 'getChangeEventsStreaming'
            ].forEach(function (httpMethod) {
                    should.exist(plant[httpMethod]().before);
                    should.exist(plant[httpMethod]().after);
                    should.exist(plant[httpMethod]().disableAuthorization);
                });

            done();
        });

    });

});
