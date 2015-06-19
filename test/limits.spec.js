var _ = require('lodash');
var request = require('supertest');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;
var should = require('should');

var seeder = require('./seeder.js');


describe('limits', function () {

    var config;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets');
    });

    describe('limits', function () {
        it('should be possible to tell how many documents to return', function (done) {
            request(config.baseUrl).get('/people?limit=1').expect(200).end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.people.length).should.equal(1);
                done();
            });
        });
    });
});
