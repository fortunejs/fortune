var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');

module.exports = function(options){
  var ids, app, baseUrl;
  beforeEach(function(){
    ids = options.ids;
    app = options.app;
    baseUrl = options.baseUrl;
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
      it.skip('should apply proper hook on linked resources on read', function(done){
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
    describe('deleting a resource referencing another one', function(){
      beforeEach(function(done){
        request(baseUrl).patch('/people/' + ids.people[0])
          .set('content-type', 'application/json')
          .send(JSON.stringify([
            {op: 'replace', path: '/people/0/links/lovers', value: [ids.people[1], ids.people[2]]},
            {op: 'replace', path: '/people/0/links/pets', value: [ids.pets[0], ids.pets[1]]},
            {op: 'replace', path: '/people/0/links/soulmate', value: ids.people[1]},
            {op: 'replace', path: '/people/0/links/addresses', value: [ids.addresses[0], ids.addresses[1]]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.people[0].links.pets).should.eql([ids.pets[0], ids.pets[1]]);
            (body.people[0].links.lovers).should.eql([ids.people[1], ids.people[2]]);
            (body.people[0].links.soulmate).should.eql(ids.people[1]);
            (body.people[0].links.addresses).should.eql([ids.addresses[0], ids.addresses[1]]);
            done();
          });
      });
      it('should work with one-to-many refs', function(done){
        request(baseUrl).del('/pets/' + ids.pets[0])
          .expect(204)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/people/' + ids.people[0])
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                body.people[0].links.pets.should.eql([ids.pets[1]]);
                done();
              });
          });
      });
      it('should work with many-to-one refs', function(done){
        request(baseUrl).del('/people/' + ids.people[0])
          .expect(204)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/addresses/' + ids.addresses[0] + ',' + ids.addresses[1])
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                should.not.exist(body.addresses[0].links);
                should.not.exist(body.addresses[1].links);
                done();
              });
          });
      });
      it('should work fine with many-to-many refs', function(done){
        request(baseUrl).del('/people/' + ids.people[0])
          .expect(204)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/people/' + ids.people[1] + ',' + ids.people[2])
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                should.not.exist(body.people[0].links);
                should.not.exist(body.people[1].links);
                done();
              });
          });
      });
      it('should work with one-to-one refs', function(done){
        request(baseUrl).del('/people/' + ids.people[0])
          .expect(204)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/people/' + ids.people[1])
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                should.not.exist(body.people[0].links);
                done();
              });
          });
      });
      it('should delete collection and unlink documents from referenced resources', function(done){
        request(baseUrl).del('/pets')
          .expect(204)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).get('/people/' + ids.people[0])
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                should.not.exist(body.people[0].links.pets);
                done();
              });
          });
      });
    });
  });

}