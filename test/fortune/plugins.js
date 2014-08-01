var should = require('should');
var _ = require('lodash');
var request = require('supertest');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

module.exports = function(options){
  describe('opinionated plugins', function(){
    var app, baseUrl, ids;
    beforeEach(function(){
      app = options.app;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });
    describe('last-modified plugin', function(){
      it('should extend resource schema', function(){
        _.each(app._resources, function(resource){
          _.has(resource.schema, 'modifiedAt').should.equal(true);
          _.has(resource.schema, 'createdAt').should.equal(true);
        });
      });
      it('should set created and modified property on each insert', function(done){
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.exist(body.people[0].modifiedAt);
            should.exist(body.people[0].createdAt);
            body.people[0].modifiedAt.should.equal(body.people[0].createdAt);
            done();
          });
      });
      it('should not modify createdAt on updates', function(done){
        new Promise(function(resolve){
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people:[{email: 'test@test.com'}]
            }))
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              resolve(body.people[0].createdAt, body.people[0].modifiedAt);
            });
        }).then(function(createdDate, modifiedDate){
          request(baseUrl).patch('/people/test@test.com')
            .set('content-type', 'application/json')
            .send(JSON.stringify([
              {op: "replace", path: "/people/0/name", value: "tested"}
            ]))
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              body.people[0].modifiedAt.should.not.equal(modifiedDate);
              body.people[0].createdAt.should.equal(createdDate);
              done();
            });
          });
      });
    });
  });
};