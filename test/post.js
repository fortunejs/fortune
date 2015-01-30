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

    describe('post a single resource', function () {
      it('post dilbert', function (done) {
        request(baseUrl)
          .post('/people')
          .send({
            person: {
              "name": "Dilbert",
              "appearances": 3457
            }
          })
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function (error, response) {
            response.body.people.should.have.length(1);
            response.body.people[0].name.should.equal('Dilbert');
            (typeof response.body.people[0].id).should.equal('string');
            ids.push(response.body.people[0].id);
            should.not.exist(error);
            done();
          });
      });
    });

    describe('post a bad resource', function () {
      it('post dilbert', function (done) {
        request(baseUrl)
          .post('/people')
          .send({
            ppl: {
              "name": "Dilbert",
              "appearances": 3457
            }
          })
          .expect(400)
          .end(function (error, response) {
            should.not.exist(error);
            should.exist(response);
            should.exist(response.error);
            should.exist(response.body);
            response.body.toString.should.match(/expected payload to contain/,
              'gives a meaningful error so the user can recover');
            done();
          });
      });
    });

    // the server is forgiving - if you mess up
    // singular/plural, then it understands what you mean
    describe('post a single resource - mix plural key with singular value', function () {
      it('post dilbert', function (done) {
        request(baseUrl)
          .post('/people')
          .send({
            people: {
              "name": "Dilbert",
              "appearances": 3457
            }
          })
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function (error, response) {
            response.body.people.should.have.length(1);
            response.body.people[0].name.should.equal('Dilbert');
            (typeof response.body.people[0].id).should.equal('string');
            ids.push(response.body.people[0].id);
            should.not.exist(error);
            done();
          });
      });
    });

    // the server is forgiving - if you mess up
    // singular/plural, then it understands what you mean
    describe('post a single resource - mix singular key with plural value', function () {
      it('post dilbert', function (done) {
        request(baseUrl)
          .post('/people')
          .send({
            person: [
              {
                "name": "Dilbert",
                "appearances": 3457
              }
            ]
          })
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function (error, response) {
            response.body.people.should.have.length(1);
            response.body.people[0].name.should.equal('Dilbert');
            (typeof response.body.people[0].id).should.equal('string');
            ids.push(response.body.people[0].id);
            should.not.exist(error);
            done();
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