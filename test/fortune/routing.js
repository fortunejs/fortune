var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');

module.exports = function(options){
  describe('routing', function(){
    var app, baseUrl, ids;
    beforeEach(function(){
      app = options.app;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });

    describe('getting a list of resources', function() {
      _.each(fixtures, function(resources, collection) {
        it('in collection "' + collection + '"', function(done) {
          request(baseUrl)
            .get('/' + collection)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              ids[collection].forEach(function(id) {
                _.contains(_.pluck(body[collection], 'id'), id).should.equal(true);
              });
              done();
            });
        });
      });
    });

    describe('getting each individual resource', function () {
      _.each(fixtures, function (resources, collection) {
        it('in collection "' + collection + '"', function (done) {
          RSVP.all(ids[collection].map(function (id) {
              return new Promise(function (resolve) {
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
                    resolve();
                  });
              });
            })).then(function () {
              done();
            });
        });
      });
    });

    describe("collection delete route", function(){
      it("should remove all data from the database for a collection", function(done){
        new Promise(function(resolve){
          request(baseUrl)
            .get("/people/")
            .expect(200)
            .end(function(err,res){
              should.not.exist(err);
              res.statusCode.should.equal(200);
              var body = JSON.parse(res.text);

              body.people.length.should.be.above(1);

              resolve();
            });
        }).then(function(){
            return new Promise(function(resolve){
              request(baseUrl)
                .del("/people/")
                .expect(204)
                .end(function(err,res){
                  should.not.exist(err);
                  resolve();
                });
            });
          }).then(function(){
            request(baseUrl)
              .get("/people/")
              .expect(200)
              .end(function(err,res){
                should.not.exist(err);
                res.statusCode.should.equal(200);
                var body = JSON.parse(res.text);

                body.people.length.should.be.equal(0);

                done();
              });
          });
      });
    });
  });
};
