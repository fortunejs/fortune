'use strict';
var request = require('supertest');
var should = require('should');
var RSVP = require('rsvp');
var _ = require('lodash');

module.exports = function(options){
  describe('fortune-multitenant integration', function(){
    var ids, baseUrl;
    beforeEach(function(){
      ids = options.ids;
      baseUrl = options.baseUrl;
    });
    it('should allow to create duplicate PK for different tenants', function(done){
      request(baseUrl).post('/people')
        .set('content-type', 'application/json')
        .send(JSON.stringify({people: [
          {email: 'dilbert@mailbert.com', _tenantId: 'testing'}
        ]}))
        .end(function(err, res){
          should.not.exist(err);
          res.statusCode.should.equal(201);
          request(baseUrl).get('/people')
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              var matches = _.filter(body.people, function(p){ return p.email === 'dilbert@mailbert.com'});
              matches.length.should.equal(2);
              (matches[0]._tenantId === matches[1]._tenantId).should.not.be.ok;
              done();
            });
        });
    });
    it('should not let create duplicate business PK within single tenant', function(done){
      request(baseUrl).post('/people')
        .set('content-type', 'application/json')
        .send(JSON.stringify({people: [
          {email: 'dilbert@mailbert.com', _tenantId: 'testing'}
        ]}))
        .expect(201)
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({people: [
              {email: 'dilbert@mailbert.com', _tenantId: 'testing'}
            ]}))
            .expect(500)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        })
    });
    describe('resources linker', function(){
      var tenantedPet;
      beforeEach(function(done){
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({people: [{
            email: 'dilbert@mailbert.com',
            _tenantId: 'testing'
          }]}))
          .expect(201)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).post('/pets')
              .set('content-type', 'application/json')
              .send(JSON.stringify({pets: [
                {name: 'Ratbert', _tenantId: 'testing'}
              ]}))
              .expect(201)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                tenantedPet = body.pets[0].id;
                done();
              });
          });
      });
      it('should bind one-to-one references to correct tenant', function(done){
        request(baseUrl).patch('/pets/' + tenantedPet)
          .set('content-type', 'application/json')
          .send(JSON.stringify([
            {op: 'replace', path: '/pets/0/owner', value: 'dilbert@mailbert.com'}
          ]))
          .expect(200)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/people?filter[email]=dilbert@mailbert.com')
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                var regularResoruce = _.find(body.people, function(p){ return !p._tenantId});
                var tenantedResource = _.find(body.people, function(p){ return p._tenantId});
                should.not.exist(regularResoruce.links);
                tenantedResource.links.pets.length.should.equal(1);
                done();
              });
          });
      });
    });
  });
};