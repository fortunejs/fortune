var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

module.exports = function(baseUrl,keys,ids) {

    describe('sorting', function(){
        it('should be possible to sort by name', function(done){
            request(baseUrl).get('/people?sort=name')
                .expect(200)
                .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    _.pluck(body.people, "name").should.eql(["Dilbert", "Wally"]);
                    done();
                });
        });

        it('should be possible to sort by name desc', function(done){
            request(baseUrl).get('/people?sort=-name')
                .expect(200)
                .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    _.pluck(body.people, "name").should.eql(["Wally", "Dilbert"]);
                    done();
                });
        });

        it('should be possible to sort by appearances', function(done){
            request(baseUrl).get('/people?sort=appearances')
                .expect(200)
                .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    _.pluck(body.people, "name").should.eql(["Wally", "Dilbert"]);
                    done();
                });
        });
    });
};