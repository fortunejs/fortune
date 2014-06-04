var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('./fixtures.json');


describe('Fortune', function () {
  var ids = {},
      port = 8891,
      baseUrl = 'http://localhost:' + port,
      app;
  
  before(function(done){
    app = require("./app")({
      adapter: "mongodb",
      db: "fortune_test",
      inflect: true
    }, port);

    app.adapter.awaitConnection().then(function(){
      done();
    });
  });


  beforeEach(function(done) {
    var createResources = [];

    _.each(fixtures, function (resources, collection) {
      createResources.push(new Promise(function (resolve) {
        var body = {};
        body[collection] = resources;

        request(baseUrl)
          .post('/' + collection)
          .send(body)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function (error, response) {
            should.not.exist(error);
            var resources = JSON.parse(response.text)[collection];
            ids[collection] = ids[collection] || [];
            resources.forEach(function (resource) {
              ids[collection].push(resource.id);
            });
            resolve();
          });
      }));
    });

    RSVP.all(createResources).then(function () {
      done();
    }, function () {
      throw new Error('Failed to create resources.');
    });

  });

  
  afterEach(function(done) {
    _.each(fixtures, function(resources, collection) {
      RSVP.all(ids[collection].map(function(id) {
        return new RSVP.Promise(function(resolve) {
          request(baseUrl)
            .del('/' + collection)
            .end(function(error) {
              resolve();
            });
        });
      })).then(function() {
        ids = {};
        done();
      }, function() {
        throw new Error('Failed to delete resources.');
      });
    });
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
            should.not.exist(body.people[0].links);
            done();
          });
      });
    });
  });

  describe("associations", function(){
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

  describe("sparse fieldsets", function(){
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
  });

  describe("Business key", function(){
    it("can be used as primary key for individual resource requests", function(done){
      request(baseUrl).get("/cars/ABC123")
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response){
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body.cars.length.should.equal(1);
          body.cars[0].id.should.equal("ABC123");
          done();
        });
    });

    it("is indexed and unique", function(done){
      var model;
      
      (model = app.adapter.model("person")).collection.getIndexes(function(err,indexData){
        model.pk.should.be.ok;
        indexData[model.pk+"_1"].should.be.ok
        done();
      });
    });
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

  describe("includes", function(){
    beforeEach(function(done){
      function link(url, path, value){
        return new Promise(function(resolve){
          var data =  [{
            op: 'replace',
            path: path,
            value: value
          }];
          request(baseUrl).patch(url)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(data))
            .end(function(err){
              should.not.exist(err);
              resolve();
            });
        });
      }
      RSVP.all([
        link('/people/' + ids.people[0], '/people/0/soulmate', ids.people[1]),
        //TODO: fortune should take care about this on its own
        link('/people/' + ids.people[1], '/people/0/soulmate', ids.people[0]),

        link('/people/' + ids.people[0], '/people/0/lovers', [ids.people[1]]),
        link('/people/' + ids.people[0], '/people/0/cars', [ids.cars[0], ids.cars[1]]),
        link('/people/' + ids.people[0], '/people/0/houses', [ids.houses[0]]),
        link('/people/' + ids.people[1], '/people/0/houses', [ids.houses[0], ids.houses[1]])
      ]).then(function(){
        done();
      });
    });
    it('many to many: should include referenced houses when querying people', function(done){
      request(baseUrl).get('/people?include=houses')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.houses).should.be.an.Array;
          (body.linked.houses.length).should.equal(2);
          done();
        });
    });
    it('many to many: should include referenced people when querying houses', function(done){
      request(baseUrl).get('/houses?include=owners')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(2);
          done();
        });
    });
    it('one to one: should include soulmate when querying people', function(done){
      request(baseUrl).get('/people?include=soulmate')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(2);
          done();
        });
    });
    it('one to many: should include pets when querying people', function(done){
      request(baseUrl).get('/cars?include=owner')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(1);
          done();
        });
    });
    it('many to one: should include people when querying cars', function(done){
      request(baseUrl).get('/people?include=cars')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.cars).should.be.an.Array;
          (body.linked.cars.length).should.equal(2);
          done();
        });
    });
  });
  describe('documents with links', function(){
    describe('creating a resource referencing another one: many-to-many', function(){
      var houseId;
      beforeEach(function(done){
        //Create new house referencing a man
        var data = {
          houses: [{
            address: 'Piccadilly',
            owners: [ids.people[0], ids.people[1]]
          }]
        };
        request(baseUrl).post('/houses')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(data))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            houseId = body.houses[0].id;
            (/[0-9a-f]{24}/.test(houseId)).should.be.ok;
            done();
          });
      });
      it("should create A correctly referencing B", function(done){
        request(baseUrl).get('/houses/' + houseId)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.houses[0].links.owners.indexOf(ids.people[0])).should.not.equal(-1);
            (body.houses[0].links.owners.indexOf(ids.people[1])).should.not.equal(-1);
            done();
          });
      });
      it("should create reference from B to A", function(done){
        request(baseUrl).get('/people/' + ids.people[0])
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.houses.indexOf(houseId)).should.not.equal(-1);

            done();
          });
      });
    });
    
    describe('hooks', function(){

      describe('Hooks configuration', function(){
        it('should apply defaults if otherwise is not specified', function(done){
          request(baseUrl).get('/cars')
            .expect(200)
            .expect('afterAllRead', '1')
            .end(done);
        });
        it('should apply global hook configuration passed with resource config', function(done){
          request(baseUrl).get('/people')
            .expect(200)
            .expect('afterAllReadPeople', '1')
            .end(done);
        });
        it('should apply specific hook configuration passed with resource config', function(done){
          request(baseUrl).get('/people')
            .expect(200)
            .expect('afterReadPerson', 'ok')
            .end(done);
        });
      });
      describe('*All hooks', function(){
        it('should be possible to disable selected hook', function(done){
          request(baseUrl).get('/cars')
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              should.not.exist(res.headers.afterall);
              should.exist(res.headers.afterallread);
              done();
            });
        });
      });
      
      describe('backward compatibility', function(){
        it('legacy before now equals to beforeWrite', function(done){
          var man = {
            people: [{
              name: 'Smith',
              email: 'smith@gmail.com'
            }]
          };
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify(man))
            .expect('before', 'called for writes only')
            .end(function(err, res){
              should.not.exist(err);
              should.not.exist(res.headers.after);
              var body = JSON.parse(res.text);
              (body.people[0].official).should.equal('Mr. Smith');
              //Thanks to .afterRW
              (body.people[0].nickname).should.equal('undefined!');
              done();
            });
        });
        it('legacy after now equals to afterRead', function(done){
          request(baseUrl).get('/people/' + ids.people[0])
            .expect(200)
            .expect('after', 'called for reads only')
            .end(function(err, res){
              should.not.exist(err);
              should.not.exist(res.headers.before);
              var body = JSON.parse(res.text);
              var person = body.people[0];
              should.not.exist(person.password);
              (person.nickname).should.equal('Super ' + person.name + '!');
              done();
            });
        });
      });
      describe('resource-specific hooks', function(){
        it('should be possible to define a hook for one resource', function(done){
          new Promise(function(resolve){
            //Read hooks
            request(baseUrl).get('/people')
              .expect(200)
              .expect('beforeReadFirst', 'one')
              .expect('beforeReadSecond', 'two')
              .expect('afterRead', 'ok')
              .end(resolve);
          }).then(function(){
            //Write hooks
            var newPerson = {
              people: [{
                name: 'Jack',
                email: 'Daniels'
              }]
            };
            request(baseUrl).post('/people')
              .set('content-type', 'application/json')
              .send(JSON.stringify(newPerson))
              .expect(201)
              .expect('beforeWrite', 'ok')
              .expect('afterWritePerson', 'ok')
              .end(done);
          });
        });
      });
      it('should apply proper hooks to related resources on read', function(done){
        //Link pet to person
        new Promise(function(resolve){
          var update = [{
            op: 'replace',
            path: '/pets/0/owner',
            value: ids.people[0]
          }];
          request(baseUrl).patch('/pets/' + ids.pets[0])
            .set('content-type', 'application/json')
            .send(JSON.stringify(update))
            .expect(200)
            .end(resolve);
        }).then(function(){
          request(baseUrl).get('/pets/' + ids.pets[0] + '/owner')
            .expect(200)
          //Expect person resource headers
            .expect('beforeReadFirst', 'one')
            .expect('beforeReadSecond', 'two')
          //And pet resource headers
            .expect('petHook', 'ok')
            .end(done);
        });
      });
      it('should apply proper hooks to linked resources on write', function(done){
        var puppet = {
          pets: [{
            name: 'fluffy',
            owner: ids.people[0]
          }],
          linked: {
            people: [{
              name: 'fluffy owner',
              email: 'who cares?'
            }]
          }
        };
        request(baseUrl).post('/pets')
          .set('content-type', 'application/json')
          .send(JSON.stringify(puppet))
          .expect(201)
          .expect('afterWritePerson', 'ok')
          .end(done);
      });
      it('should apply proper hook on linked resources on read', function(done){
        new Promise(function(resolve){
          var link = [{
            op: 'replace',
            path: '/pets/0/owner',
            value: ids.people[0]
          }];
          request(baseUrl).patch('/pets/' + ids.pets[0])
            .set('content-type', 'application/json')
            .send(JSON.stringify(link))
            .expect(200)
            .end(resolve)
        }).then(function(){
          request(baseUrl).get('/people?include=pets')
            .expect(200)
            .expect('petHook', 'ok')
            .expect('afterReadPerson', 'ok')
            .end(done);
        });
      });
    });
    describe('creating a resource referencing another one: one-to-one', function(){
      beforeEach(function(done){
        var data = {
          people: [{
            email: 'one-to-one',
            soulmate: ids.people[0]
          }]
        };
        request(baseUrl).post('/people')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(data))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            done();
          });
      });
      it("should create A correctly referencing B", function(done){
        request(baseUrl).get('/people/one-to-one')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.soulmate).should.equal(ids.people[0]);
            done();
          });
      });
      it("should create reference from B to A", function(done){
        request(baseUrl).get('/people/' + ids.people[0])
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.soulmate).should.equal('one-to-one');
            done();
          });
      });
      afterEach(function(done){
        request(baseUrl).del('/people/one-to-one')
          .expect(204)
          .end(function(err, res){
            should.not.exist(err);
            done();
          });
      });
    });
    describe('creating a resource referencing another one: many-to-one', function(){
      beforeEach(function(done){
        var data = {
          people: [{
            email: 'one-to-many',
            pets: [ids.pets[0]]
          }]
        };
        request(baseUrl).post('/people')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(data))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            done();
          });
      });
      it("should create A correctly referencing B", function(done){
        request(baseUrl).get('/people/one-to-many')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.pets.indexOf(ids.pets[0])).should.not.equal(-1);
            done();
          });
      });
      it("should create reference from B to A", function(done){
        request(baseUrl).get('/pets/' + ids.pets[0])
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.pets[0].links.owner).should.equal('one-to-many');
            done();
          });
      });
      afterEach(function(done){
        request(baseUrl).del('/people/one-to-many')
          .expect(204)
          .end(function(err, res){
            should.not.exist(err);
            done();
          });
      });
    });
    describe('creating a resource referencing another one: one-to-many', function(){
      var petId;
      beforeEach(function(done){
        var data = {
          pets: [{
            name: 'many-to-one',
            owner: ids.people[0]
          }]
        };
        request(baseUrl).post('/pets')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(data))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            petId = body.pets[0].id;
            done();
          });
      });
      it("should create A correctly referencing B", function(done){
        request(baseUrl).get('/pets/' + petId)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.pets[0].links.owner).should.equal(ids.people[0]);
            done();
          });
      });
      it("should create reference from B to A", function(done){
        request(baseUrl).get('/people/' + ids.people[0])
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.pets.indexOf(petId)).should.not.equal(-1);
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
});

