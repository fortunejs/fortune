var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var seeder = require('./seeder.js');

describe('sorting', function () {

    var config;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets');
    });

    it('should be possible to sort by name', function (done) {
        request(config.baseUrl).get('/people?sort=name').expect(200).end(function (err, res) {
            should.not.exist(err);
            var body = JSON.parse(res.text);
            _.pluck(body.people, "name").should.eql(["Dilbert", "Wally"]);
            done();
        });
    });

    it('should be possible to sort by name desc', function (done) {
        request(config.baseUrl).get('/people?sort=-name').expect(200).end(function (err, res) {
            should.not.exist(err);
            var body = JSON.parse(res.text);
            _.pluck(body.people, "name").should.eql(["Wally", "Dilbert"]);
            done();
        });
    });

    it('should be possible to sort by appearances', function (done) {
        request(config.baseUrl).get('/people?sort=appearances').expect(200).end(function (err, res) {
            should.not.exist(err);
            var body = JSON.parse(res.text);
            _.pluck(body.people, "name").should.eql(["Wally", "Dilbert"]);
            done();
        });
    });
});
