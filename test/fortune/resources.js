'use strict';
var should = require("should");
var _ = require("lodash");
var request = require("supertest");

module.exports = function(options){

  describe("/resources endpoint", function(){
    var baseUrl;
    beforeEach(function(){
      baseUrl = options.baseUrl;
    });
    it("should expose resources configured on the system", function(done){
      request(baseUrl).get('/resources')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.should.have.keys(['resources']);
          body.resources.length.should.equal(5);
          var list = _.pluck(body.resources, 'name');
          list.should.eql(['person', 'house', 'pet', 'address', 'car']);
          done();
        });
    });
    it("should provide API to filter out resources to show for specific requests", function(done){
      request(baseUrl).get('/resources')
        .set('hide-resources', 'person,house')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.resources.length.should.equal(3);
          var list = _.pluck(body.resources, 'name');
          list.should.eql(['pet','address','car']);
          done();
        });
    });
    it("should expose hooks set up on resource", function(done){
      request(baseUrl).get('/resources')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.resources[0].hooks.beforeRead.should.be.an.Array;
          body.resources[0].hooks.afterRead.should.be.an.Array;
          body.resources[0].hooks.beforeWrite.should.be.an.Array;
          body.resources[0].hooks.afterWrite.should.be.an.Array;
          done();
        });
    });
    it("should not expose hooks filtered out by hooks filters", function(done){
      request(baseUrl).get('/resources')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          var car = _.find(body.resources, function(r){ return r.name === 'car'});
          car.hooks.beforeRead.indexOf('filtered-out').should.equal(-1);
          car.hooks.beforeWrite.indexOf('filtered-out').should.equal(-1);
          done();
        });
    });
  });
};