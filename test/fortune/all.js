var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('.././fixtures.json');

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

    before(function (done) {
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

    describe('getting a list of resources', function () {
      _.each(fixtures, function (resources, collection) {
        var key = keys[collection];

        it('in collection "' + key + '"', function (done) {
          request(baseUrl)
            .get('/' + key)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (error, response) {
              should.not.exist(error);
              var body = JSON.parse(response.text);
              ids[key].forEach(function (id) {
                _.contains(_.pluck(body[key], 'id'), id).should.equal(true);
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
                .get('/' + key + '/' + id)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function (error, response) {
                  should.not.exist(error);
                  var body = JSON.parse(response.text);
                  body[key].forEach(function (resource) {
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

    require("./associations")(options,baseUrl,keys,ids);
    require("./limits")(options,baseUrl,keys,ids);

    after(function (done) {
      _.each(fixtures, function (resources, collection) {
        var key = keys[collection];

        RSVP.all(ids[key].map(function (id) {
          return new Promise(function (resolve) {
            request(baseUrl)
              .del('/' + key + '/' + id)
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

});