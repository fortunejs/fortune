'use strict';
var request = require('supertest');
var should = require('should');

module.exports = function(opts){
  describe('meta-providers', function(){
    var ids, baseUrl;
    beforeEach(function(){
      ids = opts.ids;
      baseUrl = opts.baseUrl;
    });
    it('should extend response with metadata when matching piece is requested', function(done){
      request(baseUrl).get('/people?includeMeta=sins')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.meta.sins.should.be.an.Array;
          body.meta.sins.length.should.equal(body.people.length);
          done();
        });
    });
    it('should be provided with response data to let provider decide on the response', function(done){
      request(baseUrl).get('/people/' + ids.people[0] + '?includeMeta=sins')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.meta.sins.should.be.an.Array;
          body.meta.sins.length.should.equal(1);
          body.meta.sins[0].should.equal('Dilbert is a sinner');
          done();
        });
    });
    it('should set metadata piece to whatever provider returns', function(done){
      request(baseUrl).get('/people/' + ids.people[0] + '?includeMeta=ping')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.meta.ping.should.equal('pong');
          done();
        });
    });
    it('should set error message on requested metadata when fails to match registered provider', function(done){
      request(baseUrl).get('/people/' + ids.people[0] + '?includeMeta=miss')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.meta.miss.should.equal('Metadata provider is not defined');
          done();
        });
    });
    it('should work with both synchronous and asynchronous providers', function(done){
      request(baseUrl).get('/people/' + ids.people[0] + '?includeMeta=sync,async')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.meta.sync.should.equal('sync');
          body.meta.async.should.equal('async');
          done();
        });
    });
  });
};