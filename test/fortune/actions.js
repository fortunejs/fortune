'use strict';
var should = require('should');
var request = require('supertest');

module.exports = function(options){
  describe('resources actions', function(){
    var baseUrl, ids;
    beforeEach(function(){
      baseUrl = options.baseUrl;
      ids = options.ids;
    });
    it('should be able to define custom action on resource', function(){
      return request(baseUrl).post('/people/' + ids.people[0] + '/reset-password')
        .set('content-type', 'application/json')
        .send(JSON.stringify({}))
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.text.should.equal('OK');
        });
    });
    it('should run custom action when receives action url request matching specified method', function(done){
      request(baseUrl).post('/people/' + ids.people[0] + '/reset-password')
        .set('content-type', 'application/json')
        .send(JSON.stringify({password: 'new password'}))
        .expect(200)
        .expect('reset-password', 'new password')
        .end(function(err, res){
          should.not.exist(err);
          res.text.should.equal('OK');
          done();
        });
    });
    it('should provide custom action with resolved resource', function(done){
      request(baseUrl).post('/people/' + ids.people[0] + '/reset-password')
        .set('content-type', 'application/json')
        .send(JSON.stringify({password: 'new password'}))
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.text.should.equal('OK');
          res.headers['reset-password-resource'].should.equal(ids.people[0]);
          done();
        });
    });
    it('should run regular hooks for accessed resource', function(done){
      request(baseUrl).post('/people/' + ids.people[0] + '/reset-password')
        .set('content-type', 'application/json')
        .send(JSON.stringify({password: 'new password'}))
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.text.should.equal('OK');
          //Nickname is generated dynamically by before and after hooks
          res.headers['reset-password-nickname'].should.equal('Super Dilbert!');
          done();
        });
    });
    it('should provide means of configuration through configurable function', function(done){
      request(baseUrl).post('/people/' + ids.people[0] + '/reset-password')
        .set('content-type', 'application/json')
        .send(JSON.stringify({password: 'new password'}))
        .expect(200)
        .expect('reset-password-conf', 'set from init function')
        .end(function(err, res){
          should.not.exist(err);
          res.text.should.equal('OK');
          res.headers['reset-password-nickname'].should.equal('Super Dilbert!');
          done();
        });
    });
    it('should send returned document from custom action complying to jsonapi syntax', function(done){
      request(baseUrl).post('/people/' + ids.people[0] + '/send-through')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.should.be.an.Array;
          body.people.length.should.equal(1);
          body.links.should.be.an.Object;
          done();
        });
    });
    it('should be able to run action on many resources ', function(done){
      request(baseUrl).post('/people/' + ids.people.join(',') + '/send-through')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          console.log(body);
          body.people.length.should.equal(ids.people.length);
          done();
        });
    });
    it('should be able to run action generic action', function(done) {
      request(baseUrl).post('/people/action/aggregate-by-birthday')
        .expect(200)
        .end(function(err,res) {
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.length.should.equal(1);
          done();
        })
    });
    it('should be able to run GET requests in actions', function(done){
      request(baseUrl).get('/people/' + ids.people[0] + '/echo')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.length.should.equal(1);
          body.people[0].id.should.equal(ids.people[0]);
          done();
        });
    })
  });
};
