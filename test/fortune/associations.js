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
                should.not.exist(body.pets[0].links && body.pets[0].links.owner);
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
                should.not.exist(body.people[0].links && body.people[0].links.soulmate);
                done();
              });
          });
      });
      it('should update association on PATCH', function(done){
        new Promise(function(resolve){
          var patch = [{
            op: 'replace',
            path: '/people/0/soulmate',
            value: ids.people[2]
          }];
          request(baseUrl).patch('/people/' + ids.people[0])
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(patch))
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              (body.people[0].links.soulmate).should.equal(ids.people[2]);
              resolve();
            });
        }).then(function(){
            request(baseUrl).get('/people/' + ids.people[2])
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.people[0].links.soulmate).should.equal(ids.people[0]);
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
                should.not.exist(body.people[0].links && body.people[0].links.lovers);
                done();
              });
          });
      });
    });
    describe('many to one', function(){
      it('should unbind other "many" refs when updated', function(done){
        new Promise(function(resolve){
          //Create initial binding
          request(baseUrl).patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/cars/-', op: 'add', value: ids.cars[0]},
              {path: '/people/0/links/cars/-', op: 'add', value: ids.cars[1]}
            ])
            .expect(200)
            .end(function(err){
              should.not.exist(err);
              resolve();
            });
        }).then(function(){
          return new Promise(function(resolve){
            //Update binding
            request(baseUrl).patch('/people/' + ids.people[1])
              .send([
                {path: '/people/0/links/cars/-', op: 'add', value: ids.cars[0]}
              ])
              .expect(200)
              .end(function(err){
                should.not.exist(err);
                resolve();
              });
          });
        }).then(function(){
          request(baseUrl).get('/people/' + ids.people[0] + ',' + ids.people[1])
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              var first = _.findWhere(body.people, {id: ids.people[0]});
              var second = _.findWhere(body.people, {id: ids.people[1]});
              should.exist(first.links.cars);
              (first.links.cars.length).should.equal(1);
              (first.links.cars[0]).should.equal(ids.cars[1]);
              should.exist(second.links.cars);
              (second.links.cars.length).should.equal(1);
              (second.links.cars[0]).should.equal(ids.cars[0]);
              done();
            });
        });
      });
    });
    describe('one to many', function(){
      it('should unbind other "many" when updated', function(done){
        new Promise(function(resolve){
          //Create binding
          request(baseUrl).patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/cars/-', op: 'add', value: ids.cars[0]}
            ])
            .expect(200)
            .end(function(err){
              should.not.exist(err);
              resolve();
            });
        }).then(function(){
            return new Promise(function(resolve){
              //update binding
              request(baseUrl).patch('/cars/' + ids.cars[0])
                .send([
                  {path: '/cars/0/links/owner', op: 'replace', value: ids.people[1]}
                ])
                .expect(200)
                .end(function(err){
                  should.not.exist(err);
                  resolve();
                });
            });
        }).then(function(){
            request(baseUrl).get('/people/' + ids.people[0] + ',' + ids.people[1])
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                var first = _.findWhere(body.people, {id: ids.people[0]});
                var second = _.findWhere(body.people, {id: ids.people[1]});
                should.not.exist(first.links);
                should.exist(second.links.cars);
                (second.links.cars[0]).should.equal(ids.cars[0]);
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

    describe("self-link", function(){
      beforeEach(function(done){
        request(baseUrl).patch("/people/" + ids.people[0])
          .set("content-type", "application/json")
          .send(JSON.stringify([
            {op: "replace", path: "/people/0/links/soulmate", value: ids.people[0]},
            {op: "replace", path: "/people/0/links/lovers", value: [ids.people[0]]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.people[0].links.soulmate.should.equal(ids.people[0]);
            done();
          });
      });
      it("should be able to link itself", function(done){
        request(baseUrl).patch("/people/" + ids.people[1])
          .set("content-type", "application/json")
          .send(JSON.stringify([
            {op: "replace", path: "/people/0/links/soulmate", value: ids.people[1]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.people[0].links.soulmate.should.equal(ids.people[1]);
            done();
          });
      });
      it("should handle update of self-link", function(done){
        request(baseUrl).patch("/people/" + ids.people[0])
          .set("content-type", "application/json")
          .send(JSON.stringify([
            {op: "replace", path: "/people/0/links/soulmate", value: ids.people[1]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.people[0].links.soulmate.should.equal(ids.people[1]);
            done();
          });
      });
      it("should handle update of self-link to many", function(done){
        request(baseUrl).patch("/people/" + ids.people[0])
          .set("content-type", "application/json")
          .send(JSON.stringify([
            {op: "replace", path: "/people/0/links/lovers", value: [ids.people[1]]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.people[0].links.lovers[0].should.equal(ids.people[1]);
            done();
          });
      });
    });
  });
};