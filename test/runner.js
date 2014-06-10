var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('./fixtures.json');

var port = 8891;
var baseUrl = 'http://localhost:' + port;

describe('Fortune test runner', function(){
  var options = {
    app: null,
    port: port,
    baseUrl: baseUrl,
    ids: {}
  };

  before(function(done){
    var remoteDB = process.env.DB_CONNECTION_STRING;
    
    if(remoteDB){
      console.log("Using remoted mongodb:",remoteDB);
    }
    
    options.app = require("./app")({
      adapter: "mongodb",
      connectionString: remoteDB || "mongodb://localhost/fortune_test",
      inflect: true
    }, port);

    options.app.adapter.awaitConnection().then(function(){
      done();
    });
  });

  beforeEach(function(done) {
    var createResources = [];

    _.each(fixtures, function (resources, collection) {
      createResources.push(new Promise(function (resolve) {
        var body = {};
        body[collection] = resources;

        request(baseUrl)
          .post('/' + collection)
          .send(body)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function (error, response) {
            should.not.exist(error);
            var resources = JSON.parse(response.text)[collection];
            options.ids[collection] = options.ids[collection] || [];
            resources.forEach(function (resource) {
              options.ids[collection].push(resource.id);
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

  require('./fortune/all')(options);
  require('./fortune-mongodb/mongodb.spec.js')(options);


  afterEach(function(done) {
    var promises = [];
    _.each(fixtures, function(resources, collection) {
      promises.push(new RSVP.Promise(function(resolve) {
        request(baseUrl)
          .del('/' + collection)
          .end(function(error) {
            resolve();
          });
      }));
    });
    RSVP.all(promises).then(function() {
      options.ids = {};
      done();
    }, function() {
      throw new Error('Failed to delete resources.');
    });
  });

});
