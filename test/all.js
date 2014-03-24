var should = require('should')
, _ = require('lodash')
, RSVP = require('rsvp')
, request = require('supertest')
, fixtures = require('./fixtures.json');

_.each(global.adapters, function(port, adapter) {
  var baseUrl = 'http://localhost:' + port;

  describe('using "' + adapter + '" adapter', function() {
    var ids = {};

    before(function(done) {
      var createResources = [];

      _.each(fixtures, function(resources, collection) {
        createResources.push(new RSVP.Promise(function(resolve, reject) {
          var body = {};
          body[collection] = resources; 
          request(baseUrl)
            .post('/' + collection)
            .send(body)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(error, response) { 
              if(error) return reject(error);
              var resources = JSON.parse(response.text)[collection];
              ids[collection] = ids[collection] || [];
              resources.forEach(function(resource) {
                ids[collection].push(resource.id);
              });
              resolve();
            });
        }));
      });

      RSVP.all(createResources).then(function() {
        done();
      }, function() {
        throw new Error('Failed to create resources.');
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

    describe('getting each individual resource', function() {
      _.each(fixtures, function(resources, collection) {
        it('in collection "' + collection + '"', function(done) {
          RSVP.all(ids[collection].map(function(id) {
            return new RSVP.Promise(function(resolve) {
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
          })).then(function() {
            done();
          });
        });
      });
    });

    describe('many to one association', function() {
      it('should be able to associate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
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
              resolve();
            });
        }).then(function() {
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
      });
      it('should be able to dissociate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
          request(baseUrl)
            .patch('/people/' + ids.people[0])
            .send([
              {path: '/people/0/links/pets', op: 'replace', value: []}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function() {
          request(baseUrl)
            .get('/pets/' + ids.pets[0])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.pets[0].links);
              done();
            });
        });
      });
    });

    describe('one to many association', function() {
      it('should be able to associate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
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
              resolve();
            });
        }).then(function() {
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
      it('should be able to dissociate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
          request(baseUrl)
            .patch('/pets/' + ids.pets[0])
            .send([
              {path: '/pets/0/links/owner', op: 'replace', value: null}
            ])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.pets[0].links);
              resolve();
            });
        }).then(function() {
          request(baseUrl)
            .get('/people/' + ids.people[1])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              done();
            });
        });
      });
    });

    describe('one to one association', function() {
      it('should be able to associate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
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
              resolve();
            });
        }).then(function() {
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
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function() {
          request(baseUrl)
            .get('/people/' + ids.people[1])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              done();
            });
        });
      });
    });

    describe('many to many association', function() {
      it('should be able to associate', function(done) {
        new RSVP.Promise(function(resolve, reject) {
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
              resolve();
            });
        }).then(function() {
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
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
              resolve();
            });
        }).then(function() {
          request(baseUrl)
            .get('/people/' + ids.people[1])
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.not.exist(body.people[0].links);
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
    });


    describe('compound document support', function() {
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
        new RSVP.Promise(function(resolve) {
          request(baseUrl)
            .put('/people/' + ids.people[0])
            .send({people: [{
              links: {
                pets: [ids.pets[0]],
                soulmate: ids.people[1]
              }
            }]})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body.people[0].links.pets).should.includeEql(ids.pets[0]);
              resolve();
            });
        })
          .then(function() {
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
      });

      it("should return grandchild plus child documents of people when requested", function(done) {
        new RSVP.Promise(function(resolve) {
          request(baseUrl)
            .put('/people/' + ids.people[1])
            .send({people: [{
              links: {
                pets: [ids.pets[1]]
              }
            }]})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body.people[0].links.pets).should.includeEql(ids.pets[1]);
              resolve();
            });
        })
          .then(function() {
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
      });

      it("should return grandchild without child documents of people when requested", function(done) {
        new RSVP.Promise(function(resolve) {
          request(baseUrl)
            .put('/people/' + ids.people[1])
            .send({people: [{
              links: {
                pets: [ids.pets[1]]
              }
            }]})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body.people[0].links.pets).should.includeEql(ids.pets[1]);
              resolve();
            });
        })
          .then(function() {
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
      });
    });

    after(function(done) {
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
          done();
        }, function() {
          throw new Error('Failed to delete resources.');
        });
      });
    });

  });
});

