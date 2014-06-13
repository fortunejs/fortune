var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');
var neighbourhood = require('../neighbourhood');

module.exports = function(options){
  describe('fields and filters', function(){
    var app, baseUrl, ids, adapter;
    beforeEach(function(){
      app = options.app;
      baseUrl = options.baseUrl;
      ids = options.ids;
      adapter = options.app.adapter;
    });

    describe("sparse fieldsets", function(){
      beforeEach(function(done){
        var update = [{
          op: 'add',
          path: '/people/0/pets',
          value: ids.pets[0]
        }];
        request(baseUrl).patch('/people/' + ids.people[0])
          .set('content-type', 'application/json')
          .send(JSON.stringify(update))
          .expect(200)
          .end(done);
      });
      it("should return specific fields for documents", function(done){
        request(baseUrl).get('/people?fields=name')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response){
            should.not.exist(error);
            var body = JSON.parse(response.text);
            should.not.exist(body.people[0].appearances);
            should.exist(body.people[0].name);
            done();
          });
      });

      it("should return specific fields for a single document", function(done){
        request(baseUrl).get('/people/'+ids.people[0] + "?fields=name")
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response){
            should.not.exist(error);
            var body = JSON.parse(response.text);
            should.not.exist(body.people[0].appearances);
            should.exist(body.people[0].name);
            done();
          });
      });

      it("should return specific fields for linked document of a collection", function(done){
        request(baseUrl).get('/people?include=pets&fields[pets]=name')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.not.exist(body.linked.pets[0].appearances);
            should.exist(body.linked.pets[0].name);
            done();
          });
      });

      it("should return specific fields for linked document of single doc", function(done){
        request(baseUrl).get('/people/' + ids.people[0] + '?include=pets&fields[pets]=name')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.not.exist(body.linked.pets[0].appearances);
            should.exist(body.linked.pets[0].name);
            done();
          });
      });
    });

    describe("filters", function(){
      it("should allow top-level resource filtering for collection routes", function(done){
        request(baseUrl).get('/people?filter[name]=Robert')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response){
            should.not.exist(error);
            var body = JSON.parse(response.text);
            body.people.length.should.equal(1);
            done();
          });
      });
      it("should allow top-level resource filtering based on a numeric value", function(done) {
        request(baseUrl).get('/people?filter[appearances]=1934')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response){
            should.not.exist(error);
            var body = JSON.parse(response.text);
            body.people.length.should.equal(1);
            done();
          });
      });
      it("should allow resource sub-document filtering based on a numeric value", function(done){
        request(baseUrl).get("/cars?filter[additionalDetails.seats]=2")
          .end(function(err, res){
            var body = JSON.parse(res.text);

            body.cars.length.should.be.equal(1);
            body.cars[0].id.should.be.equal('XYZ890');
            done();
          });
      });
      it('should be possible to filter related resources by ObjectId', function(done){
      var cmd = [
        {
          op: 'replace',
          path: '/people/0/pets',
          value: [ids.pets[0], ids.pets[1]]
        }
      ];
      //Give a man a pet
      request(baseUrl).patch('/people/' + ids.people[0])
        .set('Content-Type', 'application/vnd.api+json')
        .send(JSON.stringify(cmd))
        .expect(200)
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people?filter[pets]=' + ids.pets[0])
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var data = JSON.parse(res.text);
              (data.people).should.be.an.Array;
              //Make sure filtering was run by ObjectId
              (/[0-9a-f]{24}/.test(ids.pets[0])).should.be.ok;
              (/[0-9a-f]{24}/.test(data.people[0].links.pets[0])).should.be.ok;
              done();
            });
        });
    });
      it('should support filtering by id for one-to-one relationships', function(done){
        new Promise(function(resolve){
          var upd = [{
            op: 'replace',
            path: '/people/0/soulmate',
            value: ids.people[1]
          }];
          request(baseUrl).patch('/people/' + ids.people[0])
            .set('content-type', 'application/json')
            .send(JSON.stringify(upd))
            .expect(200)
            .end(function(err){
              should.not.exist(err);
              resolve();
            });
        })
          .then(function(){
            request(baseUrl).get('/people?filter[soulmate]=' + ids.people[1])
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.people[0].id).should.equal(ids.people[0]);
                done();
              });
          });
      });
      it('should support regex query', function(done){
        request(baseUrl).get('/people?filter[email][regex]=Bert@&filter[email][options]=i')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people.length).should.equal(2);
            done();
          });
      });
      it('should support `in` query', function(done){
        new Promise(function(resolve){
          var upd = [{
            op: 'add',
            path: '/people/0/houses/-',
            value: ids.houses[0]
          },{
            op: 'add',
            path: '/people/0/houses/-',
            value: ids.houses[1]
          }];
          request(baseUrl).patch('/people/' + ids.people[0])
            .set('content-type', 'application/json')
            .send(JSON.stringify(upd))
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              resolve();
            });
        })
          .then(function(){
            return new Promise(function(resolve){
              var upd = [{
                op: 'add',
                path: '/people/0/houses/-',
                value: ids.houses[1]
              },{
                op: 'add',
                path: '/people/0/houses/-',
                value: ids.houses[2]
              }];
              request(baseUrl).patch('/people/' + ids.people[1])
                .set('content-type', 'application/json')
                .send(JSON.stringify(upd))
                .expect(200)
                .end(function(err, res){
                  should.not.exist(err);
                  resolve();
                });
            });
          })
          .then(function(){
            request(baseUrl).get('/people?filter[houses][in]=' + ids.houses[0] + ',' + ids.houses[1])
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.people.length).should.equal(2);
                done();
              });
          });
      });
      describe('filtering by related objects fields', function(){
        beforeEach(function(done){
          neighbourhood(adapter, ids).then(function(){
            done();
          });
        });
        it('should be able to filter by related resource fields', function(done){
          request(baseUrl).get('/cars?filter[owner][soulmate]=' + ids.people[0])
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              (body.cars[0].id).should.equal(ids.cars[1]);
              done();
            });
        });
        it('should be able to filter by two and more parameters', function(done){
          new Promise(function(resolve){
            request(baseUrl).get('/pets?filter[owner][name][regex]=ally&filter[owner][soulmate]=' + ids.people[0])
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.pets.length).should.equal(1);
                (body.pets[0].id).should.equal(ids.pets[0]);
                resolve();
              });
          }).then(function(){
            request(baseUrl).get('/pets?filter[owner][name][regex]=ally')
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.pets.length).should.equal(2);
                done();
              });
            });
        });
      });
    });
  });
};
