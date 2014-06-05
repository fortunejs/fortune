var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');

module.exports = function(options){
  var app, ids, baseUrl;
  describe('associations', function(){
    beforeEach(function(){
      app = options.app;
      ids = options.ids;
      baseUrl = options.baseUrl;
    });

    describe('many to one association', function() {
      beforeEach(function(done){
        request(baseUrl)
          .put('/people/' + ids.people[0])
          .send({people: [{
            links: {
              pets: [ids.pets[0]]
            }
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.pets).should.includeEql(ids.pets[0]);
            done();
          });
      });
      it('should be able to associate', function(done) {
        request(baseUrl)
          .get('/pets/' + ids.pets[0])
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.pets[0].links.owner).should.equal(ids.people[0]);
            done();
          });
      });
      it('should be able to dissociate', function (done) {
        new Promise(function (resolve) {
          request(baseUrl)
            .patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/pets', op: 'replace', value: []}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function () {
            request(baseUrl)
              .get('/pets/' + ids.pets[0])
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                should.not.exist(body.pets[0].links);
                done();
              });
          });
      });
    });

    describe('one to many association', function() {
      beforeEach(function(done){
        request(baseUrl)
          .put('/pets/' + ids.pets[0])
          .send({pets: [{
            links: {
              owner: ids.people[0]
            }
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            should.equal(body.pets[0].links.owner, ids.people[0]);
            done();
          });
      });
      it('should be able to associate', function(done) {
        request(baseUrl)
          .get('/people/' + ids.people[0])
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.pets).should.includeEql(ids.pets[0]);
            done();
          });
      });
      it("should return a list of pets for a given person", function(done) {
        request(baseUrl).get('/people/' + ids.people[0] + '/pets')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response){
            should.not.exist(error);
            var body = JSON.parse(response.text);
            body.pets.length.should.equal(1);
            done();
          });
      });
      it('should be able to dissociate', function (done) {
        new Promise(function (resolve) {
          request(baseUrl)
            .patch('/pets/' + ids.pets[0])
            .send([
              {path: '/pets/0/links/owner', op: 'replace', value: null}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.pets[0].links);
              resolve();
            });
        }).then(function () {
            request(baseUrl)
              .get('/people/' + ids.people[1])
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                should.not.exist(body.people[0].links);
                done();
              });
          });
      });
    });

    describe('one to one association', function() {
      beforeEach(function(done){
        request(baseUrl)
          .put('/people/' + ids.people[0])
          .send({people: [{
            links: {
              soulmate: ids.people[1]
            }
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            should.equal(body.people[0].links.soulmate, ids.people[1]);
            done();
          });
      });
      it('should be able to associate', function(done) {
        request(baseUrl)
          .get('/people/' + ids.people[1])
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.soulmate).should.equal(ids.people[0]);
            done();
          });
      });
      it('should be able to dissociate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
          request(baseUrl)
            .patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/soulmate', op: 'replace', value: null}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function () {
            request(baseUrl)
              .get('/people/' + ids.people[1])
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                should.not.exist(body.people[0].links);
                done();
              });
          });
      });
    });

    describe('many to many association', function() {
      beforeEach(function(done){
        request(baseUrl)
          .put('/people/' + ids.people[0])
          .send({people: [{
            links: {
              lovers: [ids.people[1]]
            }
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.lovers).should.includeEql(ids.people[1]);
            done();
          });
      });
      it('should be able to associate', function(done) {
        request(baseUrl)
          .get('/people/' + ids.people[1])
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.lovers).should.includeEql(ids.people[0]);
            done();
          });
      });
      it('should be able to dissociate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
          request(baseUrl)
            .patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/lovers', op: 'replace', value: []}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function () {
            request(baseUrl)
              .get('/people/' + ids.people[1])
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                should.not.exist(body.people[0].links);
                done();
              });
          });
      });
    });

    it("should be indexed", function(done){
      var model;

      (model = app.adapter.model("person")).collection.getIndexes(function(err,indexData){
        _.each(model.schema.refkeys, function(key){
          indexData[key+"_1"].should.be.eql([[key,1]]);
        });
        done();
      });
    });
  });
};