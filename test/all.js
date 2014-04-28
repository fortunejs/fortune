var should = require('should')
, _ = require('lodash')
, RSVP = require('rsvp')
, request = require('supertest')
, fixtures = require('./fixtures.json');

var Promise = RSVP.Promise;
var fixtures = require('./fixtures.json');

_.each(global.options, function (options, port) {
  var baseUrl = 'http://localhost:' + port;
  var keys = {};

  // check if inflections are enabled.
  _.each(fixtures, function (resources, collection) {
    if (options.inflect) {
      keys[collection] = inflect.pluralize(collection);
    } else {
      keys[collection] = collection;
    }
  });

  describe('using "' + options.adapter + '" adapter', function () {
    var ids = {};

    beforeEach(function(done) {
      var createResources = [];

      _.each(fixtures, function (resources, collection) {
        var key = keys[collection];

        createResources.push(new Promise(function (resolve) {
          var body = {};
          body[key] = resources;
          request(baseUrl)
            .post('/' + key)
            .send(body)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function (error, response) {
              should.not.exist(error);
              var resources = JSON.parse(response.text)[key];
              ids[key] = ids[key] || [];
              resources.forEach(function (resource) {
                ids[key].push(resource.id);
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
              .del('/' + collection + '/' + id)
              .expect(204)
              .end(function(error) {
                should.not.exist(error);
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
        var key = keys[collection];

        it('in collection "' + key + '"', function (done) {
          RSVP.all(ids[key].map(function (id) {
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
            .patch('/' + keys.person + '/' + ids[keys.person][0])
            .send([
              {path: '/' + keys.person + '/0/links/pets', op: 'replace', value: []}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.person][0].links);
              resolve();
            });
        }).then(function () {
          request(baseUrl)
            .get('/' + keys.pet + '/' + ids[keys.pet][0])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.pet][0].links);
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
            .patch('/' + keys.pet + '/' + ids[keys.pet][0])
            .send([
              {path: '/' + keys.pet + '/0/links/owner', op: 'replace', value: null}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.pet][0].links);
              resolve();
            });
        }).then(function () {
          request(baseUrl)
            .get('/' + keys.person + '/' + ids[keys.person][1])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.person][0].links);
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
            .get('/' + keys.person + '/' + ids[keys.person][1])
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
            .patch('/' + keys.person + '/' + ids[keys.person][0])
            .send([
              {path: '/people/0/links/lovers', op: 'replace', value: []}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.person][0].links);
              resolve();
            });
        }).then(function () {
          request(baseUrl)
            .get('/' + keys.person + '/' + ids[keys.person][1])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body[keys.person][0].links);
              done();
            });
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

      it("should return immediate child documents of people when requested", function(done) {
        request(baseUrl)
          .get('/people/' + ids.people[0] + '?include=pets,soulmate')
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
            console.log(body.links["people.cars.MOT"].should.eql({type: "services"}));
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
  });
});
