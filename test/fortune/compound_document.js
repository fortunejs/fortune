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

    it("should return empty array for linked documents if there are no reference to them", function(done){
      request(baseUrl)
        .get('/people/' + ids.people[2] + '?include=pets')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.linked.pets.should.be.an.Array;
          body.linked.pets.length.should.equal(0);
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

    it('should not throw when requested to include address', function(done){
      function linkAddress(person, address){
        return new Promise(function(resolve){
          request(baseUrl).patch('/people/' + person)
            .set('content-type', 'application/json')
            .send(JSON.stringify([
              {op: 'add', path: '/people/0/links/addresses/-', value: address}
            ])).end(function(err, res){
              should.not.exist(err);
              resolve();
            })
          });
      }
      new Promise(function(resolve){
        request(baseUrl).get('/addresses').end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          resolve(RSVP.all(_.map(_.rest(body.addresses), function(addr){
            return linkAddress(ids.people[0], addr.id);
          })));
        });
      }).then(function(){
        request(baseUrl).get('/people/' + ids.people[0] + '?include=addresses')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.people[0].links.addresses.length.should.equal(2);
            body.linked.addresses.length.should.equal(2);
            done();
          });
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

    //TODO: empty suite
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

    describe("Compound document creation", function(){
      var pets = {};
      beforeEach(function(done){
        var docs = {
          people: [
            {email: "balin@dwarf.com", name: "Balin", pets: [3]},
            {email: "dwalin@dwarf.com", name: "Dwalin", pets: [1,2]}
          ],
          linked: {
            pets: [
              {name: "Lumpy", id: 1},
              {name: "Cuddles", id: 2},
              {name: "Toothy", id: 3}
            ]
          }
        };
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify(docs))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            body.linked.pets.forEach(function(pet){
              pets[pet.name] = pet.id;
            });
            done();
          });
      });
      it("should create docs from linked section", function(done){
        request(baseUrl).get("/pets/" + pets.Lumpy)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.pets.length).should.equal(1);
            (body.pets[0].name).should.equal("Lumpy");
            done();
          });
      });
      it("should properly reference linked documents from primary documents", function(done){
        request(baseUrl).get("/people/dwalin@dwarf.com,balin@dwarf.com")
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            var dwalin = _.findWhere(body.people, {name: "Dwalin"});
            (dwalin.links.pets.length).should.equal(2);
            (dwalin.links.pets.indexOf(pets.Lumpy)).should.not.equal(-1);
            (dwalin.links.pets.indexOf(pets.Cuddles)).should.not.equal(-1);
            var balin = _.findWhere(body.people, {name: "Balin"});
            (balin.links.pets.length).should.equal(1);
            (balin.links.pets.indexOf(pets.Toothy)).should.not.equal(-1);
            done();
          });
      });
      it("should properly reference primary documents from linked documents", function(done){
        request(baseUrl).get("/pets/" + pets.Lumpy + "," + pets.Cuddles + "," + pets.Toothy)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (_.findWhere(body.pets, {name: "Lumpy"}).links.owner).should.equal("dwalin@dwarf.com");
            (_.findWhere(body.pets, {name: "Cuddles"}).links.owner).should.equal("dwalin@dwarf.com");
            (_.findWhere(body.pets, {name: "Toothy"}).links.owner).should.equal("balin@dwarf.com");
            done();
          });
      });
      it("should properly handle case of a hook returning false for subresource", function(done){
        var data = {
          people: [{
            email: "falsey@bool.com",
            pets: []
          }],
          linked: {
            pets: [{
              owner: "falsey@bool.com"
            }]
          }
        };
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify(data))
          .expect(321)
          .end(function(err, res){
            should.not.exist(err);
            done();
          });
      });
      it("should not attempt to create linked external resources", function(done){
        request(baseUrl).post("/cars")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            cars: [{
              licenseNumber: "AAA"
            }],
            linked: {
              services: [{
                mot: "something"
              }]
            }
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.not.exist(body.linked);
            done();
          });
      });
      it("should respond with all created documents, including linked section", function(done){
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            people: [{
              email: "posted@post.com",
              name: "posted"
            }],
            linked: {
              pets: [{
                name: "fluffy"
              }]
            }
          }))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].email).should.equal("posted@post.com");
            (body.linked.pets[0].name).should.equal("fluffy");
            (body.linked.pets[0].links.owner).should.equal("posted@post.com");
            done();
          });
      });
      it("should be able to create multiple types of linked resources simultaneously", function(done){
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            people: [{
              email: "fili@dwarf.com",
              name: "Fili",
              links: {
                pets: [1],
                cars: [1]
              }
            },{
              email: "kili@dwarf.com",
              name: "Kili",
              links: {
                pets: [2],
                cars: [2,3]
              }
            }],
            linked: {
              pets: [
                {name: "Oin", id: 1},
                {name: "Gloin", id: 2}
              ],
              cars: [
                {licenseNumber: 111, id: 1},
                {licenseNumber: 222, id: 2},
                {licenseNumber: 333, id: 3}
              ]
            }
          }))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.pets.length).should.equal(1);
            (body.people[0].links.cars.length).should.equal(1);
            (body.people[1].links.pets.length).should.equal(1);
            (body.people[1].links.cars.length).should.equal(2);
            done();
          });
      });
      it("should be able to properly map bindings between same-type fields", function(done){
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            people: [{
              email: "thorin@dwarf.com",
              name: "Thorin",
              links: {
                houses: [1],
                estate: 2
              }
            }],
            linked: {
              houses: [{
                id: 1,
                address: "shack"
              },{
                id: 2,
                address: "mansion"
              }]
            }
          }))
          .expect(201)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.houses.length).should.equal(1);
            (body.people[0].links.estate).should.match(/[-0-9a-f]{24}/);
            var shackId = body.people[0].links.houses[0];
            var mansionId = body.people[0].links.estate;
            var shack = _.findWhere(body.linked.houses, {address: "shack"});
            var mansion = _.findWhere(body.linked.houses, {address: "mansion"});
            (shack.id).should.equal(shackId);
            (mansion.id).should.equal(mansionId);
            done();
          });
      });
      it("should succeed to link new resource to both existing and new resource", function(done){
        request(baseUrl).post("/people")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            people: [{
              email: "thorin@dwarf.com",
              name: "Thorin",
              links: {
                houses: [1, ids.houses[0]],
                estate: [2]
              }
            }],
            linked: {
              houses: [{
                id: 1,
                address: "shack"
              },{
                id: 2,
                address: "mansion"
              }]
            }
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.houses.indexOf(ids.houses[0])).should.not.equal(-1);
            (body.linked.houses.length).should.equal(3);
            done();
          });
      });
      it("should not fail if request includes additional fields", function(done){
        request(baseUrl).post("/people?include=soulmate")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            people: [{
              email: "bifur@dwarf.com",
              name: "Bifur"
            }],
            linked: {
              pets: [{
                name: "a pet"
              }]
            }
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.exist(body.linked.pets);
            should.exist(body.people[0]);
            done();
          });
      });
    });
  });

};