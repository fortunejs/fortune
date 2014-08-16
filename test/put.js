var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');

var Promise = RSVP.Promise;

_.each(global.options, function (options, port) {
  var baseUrl = 'http://localhost:' + port;


  describe('using "' + options.adapter + '" adapter', function () {

    before(function (done) {
      done();
    });

    var ids = [];

    describe('put a single resource', function () {
      it('put dilbert', function (done) {
        // first post dilbert
        request(baseUrl)
          .post('/people')
          .send({
            person: {
              "name": "Dilbert",
              "appearances": 3000
            }
          })
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function (error, response) {
            should.not.exist(error);
            var id = response.body.people[0].id;
            JSON.stringify(response.body.people[0]).should.equal(JSON.stringify({
              "id": id,
              "name": "Dilbert",
              "appearances": 3000
            }));
            // then update him
            request(baseUrl)
              .put('/people/' + id)
              .send({
                person: {
                  "name": "Dilbert",
                  "appearances": 9000
                }
              })
              .expect(200)
              .expect('Content-Type', /json/)
              .end(function (error, response) {
                should.not.exist(error);
                should.exist(response);
                response.body.people.should.have.length(1);
                JSON.stringify(response.body.people[0]).should.equal(JSON.stringify({
                  "id": id,
                  "name": "Dilbert",
                  "appearances": 9000
                }));
                done();
              });
          });
      });
    });

    after(function (done) {
      RSVP.all(ids.map(function (id) {
          return new Promise(function (resolve) {
            request(baseUrl)
              .del('/people/' + id)
              .expect(204)
              .end(function (error) {
                should.not.exist(error);
                resolve();
              });
          });
        })).then(function () {
          done();
        }, function () {
          throw new Error('Failed to delete resources.');
        });
    });

  });

});