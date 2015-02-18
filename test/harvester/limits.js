var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

module.exports = function(baseUrl,keys,ids) {

    describe('limits', function () {
        describe('limits', function () {
            //Todo: maybe this should actually test a random amount<#of resouces.
            it('should be possible to tell how many documents to return', function (done) {
                request(baseUrl)
                    .get('/' + keys.person + '?limit=1')
                    .expect(200)
                    .end(function (err, res) {
                        should.not.exist(err);
                        var body = JSON.parse(res.text);
                        (body.people.length).should.equal(1);
                        done();
                    });
            });
        });
    });
};