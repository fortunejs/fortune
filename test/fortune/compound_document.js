var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');

module.exports = function(options){
  var ids, app, baseUrl
  beforeEach(function(){
    ids = options.ids;
    app = options.app;
    baseUrl = options.baseUrl;
  });

  describe('compound document support', function() {
    beforeEach(function(done){
      new RSVP.Promise(function(resolve) {
        request(baseUrl)
          .put('/people/' + ids.people[0])
          .send({people: [{
            links: {
              pets: [ids.pets[0]],
              soulmate: ids.people[1],
              externalResources: ["ref1", "ref2"],
              cars: [ids.cars[0]]
            }
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function (error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            (body.people[0].links.pets).should.includeEql(ids.pets[0]);
            resolve();
          });
      }).then(function(){
          request(baseUrl)
            .put('/people/' + ids.people[1])
            .send({people: [{
              links: {
                pets: [ids.pets[1]]
              }
            }]})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body.people[0].links.pets).should.includeEql(ids.pets[1]);
            });
        }).then(function(){
          request(baseUrl)
            .put("/cars/" + ids.cars[0])
            .send({cars:[{
              links: {
                MOT: "fakeref"
              }
            }]})
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              (body.cars[0].links.MOT).should.equal("fakeref");
              done();
            });
        });
    });
    it("for a person should return pets, soulmate and lovers links", function(done) {
      request(baseUrl)
        .get('/people/' + ids.people[0])
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.links['people.pets'].type.should.equal('pets');
          body.links['people.soulmate'].type.should.equal('people');
          body.links['people.lovers'].type.should.equal('people');
          done();
        });
    });

    it("for a pet should return owner links", function(done) {
      request(baseUrl)
        .get('/pets/' + ids.pets[0])
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.links['pets.owner'].type.should.equal('people');
          done();
        });
    });

    it("should return immediate child documents of people when requested, ignoring invalid includes", function(done) {
      request(baseUrl)
        .get('/people/' + ids.people[0] + '?include=pets,soulmate,bananas')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.linked.pets.length.should.equal(1);
          body.linked.pets[0].id.should.equal(ids.pets[0]);
          body.linked.pets[0].name.should.equal(fixtures.pets[0].name);
          body.linked.people.length.should.equal(1);
          body.linked.people[0].name.should.equal(fixtures.people[1].name);
          body.people[0].nickname.should.equal('Super ' + fixtures.people[0].name + '!');
          body.linked.people[0].nickname.should.equal('Super ' + fixtures.people[1].name + '!');
          done();
        });
    });

    it("should return grandchild plus child documents of people when requested", function(done) {
      request(baseUrl)
        .get('/people/' + ids.people[0] + '?include=pets,soulmate,soulmate.pets')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.linked.pets.length.should.equal(2);
          body.linked.pets[0].id.should.equal(ids.pets[0]);
          body.linked.pets[0].name.should.equal(fixtures.pets[0].name);
          body.linked.pets[1].id.should.equal(ids.pets[1]);
          body.linked.pets[1].name.should.equal(fixtures.pets[1].name);
          body.linked.people.length.should.equal(1);
          body.linked.people[0].name.should.equal(fixtures.people[1].name);
          body.people[0].nickname.should.equal('Super ' + fixtures.people[0].name + '!');
          body.linked.people[0].nickname.should.equal('Super ' + fixtures.people[1].name + '!');
          body.links["people.pets"].type.should.equal("pets");
          body.links["people.soulmate.pets"].type.should.equal("pets");
          body.links["people.soulmate"].type.should.equal("people");
          done();
        });
    });

    it("should return grandchild without child documents of people when requested", function(done) {
      request(baseUrl)
        .get('/people/' + ids.people[0] + '?include=pets,soulmate.pets')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.linked.pets.length.should.equal(2);
          body.linked.pets[0].id.should.equal(ids.pets[0]);
          body.linked.pets[0].name.should.equal(fixtures.pets[0].name);
          body.linked.pets[1].id.should.equal(ids.pets[1]);
          body.linked.pets[1].name.should.equal(fixtures.pets[1].name);
          body.links["people.pets"].type.should.equal("pets");
          body.links["people.soulmate.pets"].type.should.equal("pets");
          should.not.exist(body.linked.people);
          done();
        });
    });

    it("should not attempt to include resource (to-1) marked as external", function(done){
      request(baseUrl)
        .get("/cars/" + ids.cars[0] + "?include=MOT")
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.cars[0].links.should.eql({ MOT: 'fakeref', owner: "dilbert@mailbert.com" });
          body.linked.should.eql({services: "external"});
          done();
        });
    });

    it("should not attempt to include resources (to-many) marked as external", function(done){
      request(baseUrl)
        .get("/people/" + ids.people[0] + "?include=pets,soulmate,externalResources")
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);

          var body = JSON.parse(res.text);

          body.people[0].links.pets.length.should.equal(1);
          body.people[0].links.soulmate.should.equal(ids.people[1]);
          body.people[0].links.externalResources.should.eql([ 'ref1', 'ref2' ]);

          body.linked.pets.length.should.equal(1);
          body.linked.people.length.should.equal(1);

          body.linked.externalResourceReferences.should.equal("external");

          done();
        });
    });

    it("should return a 200 response when attempting to follow a valid path", function(done) {
      request(baseUrl)
        .get("/people/" + ids.people[0] + "/pets")
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.statusCode.should.equal(200);
          done();
        });
    });

    it("should return a 404 response when attempting to follow an invalid path", function(done) {
      request(baseUrl)
        .get("/people/" + ids.people[0] + "/fish")
        .expect(404)
        .end(function(err, res){
          should.not.exist(err);
          res.statusCode.should.equal(404);
          done();
        });
    });


    it("should append links for external references", function(done){
      request(baseUrl)
        .get("/people/" + ids.people[0] + "?include=cars,cars.MOT")
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);

          var body = JSON.parse(res.text);
          done();
        });
    });

    describe("Adding new fields to a model", function() {
      beforeEach(function(done) {
        // Remove a field from the model
        // Fortune should treat this as if it were an empty array
        // when resolving links
        request(baseUrl)
          .post("/remove-pets-link/" + ids.people[0])
          .end(function(err) {
            should.not.exist(err);
            done();
          });
      });

      it("should return an empty array when requesting linked pets for a person without pet links", function(done) {
        request(baseUrl)
          .get("/people/" + ids.people[0] + "/pets")
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.statusCode.should.equal(200);
            var body = JSON.parse(res.text);
            body.pets.length.should.equal(0);
            done();
          });
      });
    });
  });

};