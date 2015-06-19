var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var seeder = require('./seeder.js');


describe('paging', function () {

    var config;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets');
    });

    it('should be possible to get page 1', function (done) {
        request(config.baseUrl).get('/people?sort=name&offset=0&limit=1').expect(200).end(function (err, res) {
            should.not.exist(err);
            var body = JSON.parse(res.text);
            // console.log(body);
            (body.people.length).should.equal(1);
            _.pluck(body.people, "name").should.eql(["Dilbert"]);
            done();
        });
    });

    it('should be possible to get page 2', function (done) {
        request(config.baseUrl).get('/people?sort=name&offset=1&limit=1').expect(200).end(function (err, res) {
            should.not.exist(err);
            var body = JSON.parse(res.text);
            // console.log(body);
            (body.people.length).should.equal(1);
            _.pluck(body.people, "name").should.eql([ "Wally"]);
            done();
        });
    });
});
