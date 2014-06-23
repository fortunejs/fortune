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

    describe("PATCH add method", function(){
      beforeEach(function(done){
        var cmd = [{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[0]
        }];
        patch('/people/' + ids.people[0], cmd, done);
      });
      it('should atomically add item to array', function(done){
        var cmd = [{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[1]
        }];
        patch('/people/' + ids.people[0], cmd, function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.people[0].links.houses.length).should.equal(2);
          (body.people[0].links.houses[1]).should.equal(ids.houses[1]);
          done();
        });
      });
      it('should also update related resource', function(done){
        request(baseUrl).get('/houses/' + ids.houses[0])
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.houses[0].links.owners[0]).should.equal(ids.people[0]);
            done();
          });
      });
      it('should support bulk update', function(done){
        var cmd = [{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[0]
        },{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[0]
        }];
        patch('/people/' + ids.people[0], cmd, function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.people[0].links.houses.length).should.equal(3);
          done();
        });
      });
      //helpers
      function patch(url, cmd, cb){
        request(baseUrl).patch(url)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(cmd))
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            cb(err, res);
          });
      }
    });
    describe("PATCH remove method", function(){

      /*
       * After this people[0] should have 3 houses
       * and three different houses should reference people[0]
       */
      beforeEach(function(done){
        var cmd = [{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[0]
        },{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[1]
        },{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[2]
        }];
        patch('/people/' + ids.people[0], cmd, function(err){
          should.not.exist(err);
          done();
        });
      });
      /*
       * After this houses[0] should have three owners
       */
      beforeEach(function(done){
        var cmd = [{
          op: 'add',
          path: '/houses/0/owners/-',
          value: ids.people[1]
        },{
          op: 'add',
          path: '/houses/0/owners/-',
          value: ids.people[2]
        }];
        patch('/houses/' + ids.houses[0], cmd, function(err){
          should.not.exist(err);
          done();
        });
      });
      it('should atomically remove array item', function(done){
        var cmd = [{
          op: 'remove',
          path: '/people/0/houses/' + ids.houses[0]
        }];
        patch('/people/' + ids.people[0], cmd, function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.people).should.be.an.Array;
          (body.people[0].links.houses.length).should.equal(2);
          (body.people[0].links.houses.indexOf(ids.houses[0])).should.equal(-1);
          done();
        });
      });
      it('should also update referenced item', function(done){
        var cmd = [{
          op: 'remove',
          path: '/people/0/houses/' + ids.houses[0]
        }];
        patch('/people/' + ids.people[0], cmd, function(err){
          should.not.exist(err);
          request(baseUrl).get('/houses/' + ids.houses[0])
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              (body.houses[0].links.owners.length).should.equal(2);
              (body.houses[0].links.owners.indexOf(ids.people[0])).should.equal(-1);
              done();
            });
        });
      });
      it('should support bulk operation', function(done){
        var cmd = [{
          op: 'remove',
          path: '/people/0/houses/' + ids.houses[0]
        },{
          op: 'remove',
          path: '/people/0/houses/' + ids.houses[1]
        }];
        patch('/people/' + ids.people[0], cmd, function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.people[0].links.houses.length).should.equal(1);
          done();
        });
      });
      //helpers
      function patch(url, cmd, cb){
        request(baseUrl).patch(url)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(cmd))
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            cb(err, res);
          });
      }

    });
    describe("PUT individual route", function(){
      it("should create document if there's no such one with provided id and update if it exists", function(done){
        new Promise(function(resolve){
          var doc = {
            people: [{
              name: "Gilbert",
              email: "gilbert@mailbert.com"
            }]
          };
          request(baseUrl).put("/people/gilbert@mailbert.com")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(doc))
            .end(function(err, res){
              should.not.exist(err);
              (res.statusCode).should.equal(201);
              resolve();
            })
        }).then(function(){
            var upd = {
              people: [{
                name: "Huilbert",
                email: "gilbert@mailbert.com"
              }]
            };
            request(baseUrl).put("/people/gilbert@mailbert.com")
              .set("Content-Type", "application/json")
              .send(JSON.stringify(upd))
              .end(function(err, res){
                should.not.exist(err);
                (res.statusCode).should.equal(200);
                done();
              });
          });
      });
    });
    describe('resources metadata', function(){
      it('should be able to expose resources metadata', function(done){
        request(baseUrl).get('/resources')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.resources).should.be.an.Array;
            should.exist(body.resources[0].name);
            should.exist(body.resources[0].schema);
            should.exist(body.resources[0].route);
            done();
          });
      });
    });
  });
};
