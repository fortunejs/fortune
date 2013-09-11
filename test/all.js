var should = require('should')
  , _ = require('lodash')
  , request = require('supertest')
  , fixtures = require('./fixtures.json')
  , ids = global._ids;

describe('using "' + global.adapter + '" adapter', function() {

  describe('getting resources', function() {
    _.each(fixtures, function(resources, collection) {
      it('in collection "' + collection + '" should get a list', function(done) {
        request(baseUrl)
        .get('/' + collection)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body[collection].forEach(function(resource) {
            _.contains(ids[collection], resource.id).should.equal(true);
          });
          done();
        });
      });
    });
  });

  describe('getting individual resources', function() {
    _.each(fixtures, function(resources, collection) {
      describe('in collection "' + collection + '"', function() {
        ids[collection].forEach(function(id) {
          it('with id "' + id + '" should get a resource', function(done) {
            request(baseUrl)
            .get('/' + collection + '/' + id)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              body[collection].forEach(function(resource) {
                (resource.id).should.equal(id);
              });
              done();
            });
          });
        });
      });
    });
  });

  describe('deleting resources', function() {
    _.each(fixtures, function(resources, collection) {
      describe('in collection "' + collection + '"', function() {
        ids[collection].forEach(function(id) {
          it('with id "' + id + '" should work', function(done) {
            request(baseUrl)
            .del('/' + collection + '/' + id)
            .expect(204)
            .end(function(error) {
              should.not.exist(error);
              done();
            });
          });
        });
      });
    });
  });

});
