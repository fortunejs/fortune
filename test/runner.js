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
    var remoteDB = process.env.WERCKER_MONGODB_URL ? process.env.WERCKER_MONGODB_URL + '/fortune' : null;

    if(remoteDB){
      console.log("Using remote mongodb:",remoteDB);
    }

    options.app = require("./app")({
      adapter: "mongodb",
      connectionString: remoteDB || "mongodb://localhost/fortune_test",
      inflect: true
    }, port);

    var app = options.app;
    options.app.adapter.awaitConnection().then(function(){
      return new RSVP.Promise(function(resolve){
        app.adapter.mongoose.connections[1].db.collectionNames(function(err, collections){
          resolve(_.compact(_.map(collections, function(collection){

            var name = collection.name.split(".")[1];
            if(name && name !== "system"){
              return new RSVP.Promise(function(resolve){
                app.adapter.mongoose.connections[1].db.collection(name, function(err, collection){
                  collection.remove({},null, function(){
                    console.log("Wiped collection", name);
                    resolve();
                  });
                });
              });
            }
            return null;
          })));
        });
      });
    }).then(function(wipeFns){
        console.log("Wiping collections:");
        return RSVP.all(wipeFns);
      }).then(function(){
        app.router.post("/remove-pets-link/:personid", function(req, res) {
          var Person = app.adapter.model("person");
          Person.findOne({email: req.params.personid}, function(err,person) {
            if (err) {
              console.error(err);
              res.send(500,err);
              return;
            }
            person.pets = null;
            person.save(function() {
              res.send(200);
            });
          });

        });
      }).then(done);
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
  require('./querytree')(options);


  afterEach(function(done) {
    var promises = [];
    _.each(fixtures, function(resources, collection) {
      promises.push(new RSVP.Promise(function(resolve) {
        request(baseUrl)
          .del('/' + collection + '?destroy=true')
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
