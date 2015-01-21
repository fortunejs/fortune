var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

module.exports = function(baseUrl,keys,ids) {

  describe('associations', function () {

    describe('many to one association', function () {
      it('should be able to associate', function (done) {
        new Promise(function (resolve) {
          var payload = {};

          payload[keys.person] = [
            {
              links: {
                pets: [ids[keys.pet][0]]
              }
            }
          ];

          request(baseUrl)
            .put('/' + keys.person + '/' + ids[keys.person][0])
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body[keys.person][0].links.pets).should.containEql(ids[keys.pet][0]);
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
                (body[keys.pet][0].links.owner).should.equal(ids[keys.person][0]);
                done();
              });
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

    describe('one to many association', function () {
      it('should be able to associate', function (done) {
        new Promise(function (resolve) {
          var payload = {};

          payload[keys.pet] = [
            {
              links: {
                owner: ids[keys.person][0]
              }
            }
          ];

          request(baseUrl)
            .put('/' + keys.pet + '/' + ids[keys.pet][0])
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.equal(body[keys.pet][0].links.owner, ids[keys.person][0]);
              resolve();
            });
        }).then(function () {
            request(baseUrl)
              .get('/' + keys.person + '/' + ids[keys.person][0])
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function (error, response) {
                should.not.exist(error);
                var body = JSON.parse(response.text);
                (body[keys.person][0].links.pets).should.containEql(ids[keys.pet][0]);
                done();
              });
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

    describe('one to one association', function () {
      it('should be able to associate', function (done) {
        new Promise(function (resolve) {
          var payload = {};

          payload[keys.person] = [
            {
              links: {
                soulmate: ids[keys.person][1]
              }
            }
          ];

          request(baseUrl)
            .put('/' + keys.person + '/' + ids[keys.person][0])
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              should.equal(body[keys.person][0].links.soulmate, ids[keys.person][1]);
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
                (body[keys.person][0].links.soulmate).should.equal(ids[keys.person][0]);
                done();
              });
          });
      });
      it('should be able to dissociate', function (done) {
        new Promise(function (resolve) {
          request(baseUrl)
            .patch('/' + keys.person + '/' + ids[keys.person][0])
            .send([
              {path: '/' + keys.person + '/0/links/soulmate', op: 'replace', value: null}
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

    describe('many to many association', function () {
      it('should be able to associate', function (done) {
        new Promise(function (resolve) {
          var payload = {};

          payload[keys.person] = [
            {
              links: {
                lovers: [ids[keys.person][1]]
              }
            }
          ];

          request(baseUrl)
            .put('/' + keys.person + '/' + ids[keys.person][0])
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              (body[keys.person][0].links.lovers).should.containEql(ids[keys.person][1]);
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
                (body[keys.person][0].links.lovers).should.containEql(ids[keys.person][0]);
                done();
              });
          });
      });
      it('should be able to dissociate', function (done) {
        new Promise(function (resolve) {
          request(baseUrl)
            .patch('/' + keys.person + '/' + ids[keys.person][0])
            .send([
              {path: '/' + keys.person + '/0/links/lovers', op: 'replace', value: []}
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
  });
};