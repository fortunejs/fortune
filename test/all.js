var _ = require('lodash')
  , should = require('should')
  , request = require('supertest');

describe('Fortune', function() {
  ['mongodb'].forEach(function(adapter) {
    describe('using "' + adapter + '" adapter', function() {
      runTest(adapter);
    });
  });
});

function runTest(adapter) {

  // test application
  var port = 8890
    , baseUrl = 'http://localhost:' + port
    , app = require('./app')(adapter, port)
    , fixtures = require('./fixtures.json')
    , ids = {};

  _.each(fixtures, function(resources, collection) {
    var counter = 0;
    ids[collection] = resources.map(function(resource) {
      counter++;
      if(adapter == 'mongodb') {
        resource.id = app.adapter.mongoose.Types.ObjectId(counter).toString();
        return resource.id;
      } else {
        resource.id = counter;
        return resource.id;
      }
    });
  });

  before(function(done) {
    app.adapter.awaitConnection().then(done);
  });

  describe('creating resources', function() {
    _.each(fixtures, function(resources, collection) {
      it('in collection "' + collection + '" should work', function(done) {
        var body = {};
        body[collection] = resources;
        request(baseUrl)
        .post('/' + collection + '/')
        .send(body)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(error) {
          should.not.exist(error);
          done();
        });
      });
    });
  });

  describe('getting resources', function() {
    _.each(fixtures, function(resources, collection) {
      it('in collection "' + collection + '" should get a list', function(done) {
        request(baseUrl)
        .get('/' + collection)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(error, response) {
          should.not.exist(error);
          var body = JSON.parse(response.text);
          body[collection].forEach(function(resource) {
            _.contains(ids[collection], resource.id).should.equal(true);
          });
          done();
        });
      });
    });
  });

  describe('getting individual resources', function() {
    _.each(fixtures, function(resources, collection) {
      describe('in collection "' + collection + '"', function() {
        ids[collection].forEach(function(id) {
          it('with id "' + id + '" should get a resource', function(done) {
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
              done();
            });
          });
        });
      });
    });
  });

  describe('deleting resources', function() {
    _.each(fixtures, function(resources, collection) {
      describe('in collection "' + collection + '"', function() {
        ids[collection].forEach(function(id) {
          it('with id "' + id + '" should work', function(done) {
            request(baseUrl)
            .del('/' + collection + '/' + id)
            .expect(204)
            .end(function(error) {
              should.not.exist(error);
              done();
            });
          });
        });
      });
    });
  });

}
