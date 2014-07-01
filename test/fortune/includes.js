var inflect= require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('../fixtures.json');

module.exports = function(options){
  var ids, app, baseUrl;
  beforeEach(function(){
    ids = options.ids;
    app = options.app;
    baseUrl = options.baseUrl;
  });

  describe("includes", function(){
    beforeEach(function(done){
      function link(url, path, value){
        return new Promise(function(resolve){
          var data =  [{
            op: 'replace',
            path: path,
            value: value
          }];
          request(baseUrl).patch(url)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(data))
            .end(function(err){
              should.not.exist(err);
              resolve();
            });
        });
      }
      RSVP.all([
          link('/people/' + ids.people[0], '/people/0/soulmate', ids.people[1]),
          //TODO: fortune should take care about this on its own
          link('/people/' + ids.people[1], '/people/0/soulmate', ids.people[0]),

          link('/people/' + ids.people[0], '/people/0/lovers', [ids.people[1]]),
          link('/people/' + ids.people[0], '/people/0/cars', [ids.cars[0], ids.cars[1]]),
          link('/people/' + ids.people[0], '/people/0/houses', [ids.houses[0]]),
          link('/people/' + ids.people[1], '/people/0/houses', [ids.houses[0], ids.houses[1]]),
          link('/people/' + ids.people[1], '/people/0/estate', [ids.houses[0]])
        ]).then(function(){
          done();
        });
    });
    it('many to many: should include referenced houses when querying people', function(done){
      request(baseUrl).get('/people?include=houses')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.houses).should.be.an.Array;
          (body.linked.houses.length).should.equal(2);
          done();
        });
    });
    it('many to many: should include referenced people when querying houses', function(done){
      request(baseUrl).get('/houses?include=owners')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(2);
          done();
        });
    });
    it('one to one: should include soulmate when querying people', function(done){
      request(baseUrl).get('/people?include=soulmate')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(2);
          done();
        });
    });
    it('one to many: should include pets when querying people', function(done){
      request(baseUrl).get('/cars?include=owner')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.people).should.be.an.Array;
          (body.linked.people.length).should.equal(1);
          done();
        });
    });
    it('many to one: should include people when querying cars', function(done){
      request(baseUrl).get('/people?include=cars')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked).should.be.an.Object;
          (body.linked.cars).should.be.an.Array;
          (body.linked.cars.length).should.equal(2);
          done();
        });
    });
    it('should include uniq documents', function(done){
      request(baseUrl).get('/people/' + ids.people[1] + '?include=houses,estate')
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          (body.linked.houses.length).should.equal(2);
          done();
        });
    });
  });
}