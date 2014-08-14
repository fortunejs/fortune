var request = require('supertest');
var should = require('should');
var RSVP = require('rsvp');

module.exports = function(options){
  var ids, app, baseUrl;
  beforeEach(function(){
    ids = options.ids;
    app = options.app;
    baseUrl = options.baseUrl;
  });

  describe("hooks", function(){
    it("should stop processing a request if a before hook returns false", function(done) {
      var petCount;
      request(baseUrl).get('/pets/')
        .set('content-type', 'application/json')
        .end(function(err, res) {
          petCount = JSON.parse(res.text).pets.length;
          request(baseUrl).post('/pets/?failbeforeAllWrite=boolean')
          .set('content-type', 'application/json')
          .send(JSON.stringify({pets: [{name: 'dave'}]}))
          .end(function(req, res) {
            res.statusCode.should.equal(321);
            request(baseUrl).get('/pets/')
              .set('content-type', 'application/json')
              .end(function(err, res) {
                JSON.parse(res.text).pets.length.should.equal(petCount);
                done();
            });
        });
      });
    });

    it("should stop processing a request if a before hook returns false via a promise", function(done) {
      var petCount;
      request(baseUrl).get('/pets/')
        .set('content-type', 'application/json')
        .end(function(err, res) {
          petCount = JSON.parse(res.text).pets.length;
          request(baseUrl).post('/pets/?failbeforeAllWrite=promise')
          .set('content-type', 'application/json')
          .send(JSON.stringify({pets: [{name: 'dave'}]}))
          .end(function(req, res) {
            res.statusCode.should.equal(321);
            request(baseUrl).get('/pets/')
              .set('content-type', 'application/json')
              .end(function(err, res) {
                JSON.parse(res.text).pets.length.should.equal(petCount);
                done();
            });
        });
      });
    });

    it("should apply global hooks in priority order", function(done){
      request(baseUrl).get("/people")
        .end(function(err, res){
          should.not.exist(err);
          res.headers.globalpriority.should.equal("correct");
          done();
        });
    });
    it("should apply resource hooks in priority order", function(done){
      request(baseUrl).get("/houses")
        .end(function(err, res){
          should.not.exist(err);
          res.headers.resourcepriority.should.equal("correct");
          done();
        });
    });
    it("should apply asynchronous hooks in series according to priority", function(done){
      request(baseUrl).get("/pets")
        .end(function(err, res){
          should.not.exist(err);
          res.headers.asyncseries.should.equal("correct");
          done();
        });
    });
  });
  describe.skip("native mongoose middleware", function(){
    it("should be able to expose mongoose api to resources", function(done){
      new RSVP.Promise(function(resolve){
        request(baseUrl).post("/houses")
          .set("content-type", "application/json")
          .send(JSON.stringify({
            houses: [{
              address: "mongoose-"
            }]
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            resolve(body.houses[0].id);
          });
      }).then(function(createdId){
        request(baseUrl).get("/houses/" + createdId)
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            (body.houses[0].address).should.match(/mongoosed$/);
            done();
          });
      });
    });
  });
};
