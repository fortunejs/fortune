var request = require('supertest');
var should = require('should');

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
  });
  describe("native mongoose middleware", function(){
    it("should be able to expose mongoose api to resources", function(done){
      request(baseUrl).get("/houses/" + ids.houses[0])
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.houses[0].address).should.match(/mongoosed$/);
          done();
        });
    });
  });
};