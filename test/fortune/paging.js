var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

module.exports = function(baseUrl,keys,ids) {

    describe('paging', function(){
        it('should be possible to get page 1', function(done){
            request(baseUrl).get('/people?sort=name&offset=0&limit=1')
                .expect(200)
                .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    // console.log(body);
                    (body.people.length).should.equal(1);
                    _.pluck(body.people, "name").should.eql(["Dilbert"]);
                    done();
                });
        });

        it('should be possible to get page 2', function(done){
            request(baseUrl).get('/people?sort=name&offset=1&limit=1')
                .expect(200)
                .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    // console.log(body);
                    (body.people.length).should.equal(1);
                    _.pluck(body.people, "name").should.eql([ "Wally"]);
                    done();
                });
        });
    });
}