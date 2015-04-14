'use strict';
var request = require('supertest');
var should = require('should');
var RSVP = require('rsvp');

module.exports = function(options){
  describe('should upsert logic', function(){
    var ids, baseUrl;
    beforeEach(function(){
      ids = options.ids;
      baseUrl = options.baseUrl;
    });

    function createDuplicate(){
      return new RSVP.Promise(function(resolve){
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [
              {
                "name": "Dupe",
                "appearances": 987,
                "birthday": "1958-04-02",
                "email": "dupe@mailbert.com",
                upsertTest: 'match'
              }
            ]
          }))
          .expect(201)
          .end(function(err){
            should.not.exist(err);
            resolve();
          });
      });
    }

    function countDupes(){
      return new RSVP.Promise(function(resolve) {
        request(baseUrl).get('/people?filter[upsertTest]=match')
          .end(function (err, res) {
            var body = JSON.parse(res.text);
            resolve(body.people.length);
          });
      });
    }

    it('should not create duplicate user with matching upsert key', function(done){
      createDuplicate().then(function(){
          return createDuplicate();
        }).then(function(){
          return countDupes();
        }).then(function(count){
          count.should.equal(1);
          done();
        })
    });
    it('should not create duplicate user with matching upsert key if creates are running in parallel', function(done){
      RSVP.all([
        createDuplicate(),
        createDuplicate(),
        createDuplicate(),
        createDuplicate(),
        createDuplicate(),
        createDuplicate(),
        createDuplicate(),
        createDuplicate()
      ]).then(function(){
        return countDupes();
      }).then(function(count){
        count.should.equal(1);
        done();
      });
    });
    it('should not overwrite embedded documents', function(done){
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [
              {
                "email": "test@test.com",
                upsertTest: 'match',
                nested: {
                  field1: "first"
                }
              }
            ]
          }))
          .expect(201)
          .end(function(err){
            should.not.exist(err);
            request(baseUrl).post('/people')
              .set('content-type', 'application/json')
              .send(JSON.stringify({
                people: [
                  {
                    "email": "test@test.com",
                    upsertTest: 'match',
                    nested: {
                      field2: "second"
                    }
                  }
                ]
              }))
              .expect(201)
              .end(function(err){
                should.not.exist(err);
                request(baseUrl).get('/people/test@test.com')
                  .expect(200)
                  .end(function(err, res){
                    should.not.exist(err);
                    var body = JSON.parse(res.text);
                    should.exist(body.people[0].nested.field1);
                    should.exist(body.people[0].nested.field2);
                    done();
                  });
              });
          });
    });
    it('should not cast arrays to objects', function(done){
      request(baseUrl).post('/people')
        .set('content-type', 'application/json')
        .send(JSON.stringify({
          people: [
            {
              "email": "test@test.com",
              upsertTest: 'match',
              links: {
                cars: [ids.cars[0]]
              }
            }
          ]
        }))
        .expect(201)
        .end(function(err, res) {
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people[0].links.cars.should.be.an.Array;
          done();
        });
    });
    it('should not fail to set nested properties on key which value is "null"', function(done){
      request(baseUrl).post('/people')
        .set('content-type', 'application/json')
        .send(JSON.stringify({
          people: [{
            email: 'test@test.com',
            upsertTest: 'match',
            nested: null
          }]
        }))
        .expect(201)
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com',
                upsertTest: 'match',
                nested: {
                  field1: 'one',
                  field2: 'two'
                }
              }]
            }))
            .expect(201)
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              body.people[0].nested.should.be.an.Object;
              body.people[0].nested.should.have.keys(['field1', 'field2']);
              done();
            });
        });
    });
  });
};