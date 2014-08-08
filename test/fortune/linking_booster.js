var should = require("should");
var sinon = require("sinon");
var LinkingBooster = require("../../lib/linking-booster");
var _ = require("lodash");
var RSVP = require("rsvp");
var request = require("supertest");
var Promise = RSVP.Promise;

module.exports = function(options){
  describe("resource linking performance", function(){
    var app, baseUrl, ids;
    beforeEach(function(){
      app = options.app;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });

    beforeEach(function(done){
      //Create circular links
      console.log(ids.people[0], ids.people[1], ids.people[2]);
      request(baseUrl).patch("/people/" + ids.people[0])
        .set("content-type", "application/json")
        .send(JSON.stringify([
          {op: "replace", "path": "/people/0/soulmate", value: ids.people[1]},
          {op: "add", "path": "/people/0/lovers/-", value: ids.people[2]}
        ]))
        .end(function(err){
          should.not.exist(err);
          console.log(ids.people[2]);
          request(baseUrl).patch("/people/" + ids.people[2])
            .set("content-type", "application/json")
            .send(JSON.stringify([
              {op: "add", path: "/people/0/lovers/-", value: ids.people[1]}
            ]))
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it("should link in under * seconds", function(done){
      //var include = "?include=soulmate";
       var include = "?include=soulmate" +
         ",soulmate.lovers" +
         ",soulmate.lovers.soulmate" +
         ",soulmate.lovers.soulmate.lovers" +
         ",soulmate.lovers.soulmate.lovers.soulmate" +
         ",soulmate.lovers.soulmate.lovers.soulamte.lovers" +
         ",soulmate.lovers.soulmate.lovers.soulmate.lovers.soulmate" +
         ",soulmate.lovers.soulmate.lovers.soulmate.lovers.soulmate.lovers";
      var t = process.hrtime();
      request(baseUrl).get("/people/" + ids.people[0] + include)
        .expect(200)
        .end(function(err, body){
          should.not.exist(err);
          console.log('total time: ', process.hrtime(t));
          done();
        });
    });
  });

  describe.only("linking booster", function(){
    var mockResources, booster, director;

    beforeEach(function(){
      mockResources = {
        person: {
          schema: {
            pets: [{ref: 'pet', inverse: 'owner'}],
            cats: {ref: 'pet'},
            employer: {ref: 'business', external: true}
          }
        },
        pet: {
          schema: {
            owner: {ref: 'person', inverse: 'pets'},
            toys: [{ref: 'toy', inverse: 'pet'}]
          }
        },
        toy: {
          schema: {
            pet: {ref: 'pet', inverse: 'toys'}
          }
        }
      };

      var directMethods = {
        get: sinon.stub().returns(RSVP.resolve())
      };
      director = {
        methods: directMethods
      };
      var inflect = {};
      inflect.pluralize = function(str){
        return {
          pet: 'pets',
          person: 'people',
          toy: 'toys'
        }[str];
      };

      booster = LinkingBooster.init(director, inflect, mockResources);
    });

    it('should skip for no includes', function(done){
      booster.groupIncludes = sinon.stub();
      booster.startLinking({query: {}}).then(function(){
        booster.groupIncludes.callCount.should.equal(0);
        done();
      });
    });
    it('should group requests to same resource', function(){
      var req = {path: '/people/personId', query: {include: 'pets,pets.toys'}};
      var includes = ['pets', 'pets.toys'];
      var groups = booster.groupIncludes(req, includes);
      groups.pets.filter.should.eql({owner: {$in: ['personId']}});
      groups.pets.include[0].should.eql([]);
      groups.pets.include[1][0].should.equal('toys');
    });
    it('should ignore invalid includes', function(){
      var req = {path: '/people/personId', query: {include: 'pets,bad'}};
      var includes = ['pets', 'bad'];
      var groups = booster.groupIncludes(req, includes);
      should.exist(groups.pets);
      Object.keys(groups).length.should.equal(1);
    });
    it('should be able to define if include can be boosted', function(){
      booster.canBoost({path: '/people/personId', query: {include: 'pets'}}).should.equal(true);
      booster.canBoost({path: '/people', query: {include: 'employer'}}).should.equal(false);
      booster.canBoost({path: '/people/', query: {include: 'pets'}}).should.equal(false);
      booster.canBoost({path: '/people/personId', query: {}}).should.equal(false);
    });
    it('should not try to include external refs', function(){
      var req = {path: '/people/personId', query: {include: 'employer'}};
      var includes = ['employer'];
      var groups = booster.groupIncludes(req, includes);
      groups.should.eql({});
    });
    it('should not try to fetch local refs if the link is one-way', function(){
      var req = {path: '/people/personId', query: {include: 'cats'}};
      var includes = ['cats'];
      var groups = booster.groupIncludes(req, includes);
      groups.should.eql({});
    });
    it('should drop boosted includes from initial request', function(){
      var req = {path: '/people/personId', query: {include: 'pets,employer'}};
      var includes = ['pets', 'employer'];
      booster.groupIncludes(req, includes);
      req.query.include.should.equal('employer');
      req.originalIncludes.should.eql(['pets', 'employer']);
    });
    it('should restore modified req object', function(){
      var req = {query: {}, originalIncludes: ['something']};
      booster.restoreRequest(req);
      req.query.include.should.equal('something');
    });
    it('should pass proper request params to director to fetch related resources', function(done){
      var req = {
        path: '/people/personId',
        query: {
          include: 'pets'
        }
      };
      booster.startLinking(req).then(function(){
        var directArgs = director.methods.get.getCall(0).args;
        directArgs[0].should.equal('pets');
        directArgs[1].should.eql({
          filter: {owner: {$in: ['personId']}},
          include: ''
        });
        done();
      });
    });

    it('should be able to merge received result', function(done){
      var req = {
        path: '/people/personId'
      };
      var linker = RSVP.resolve([{
        pets: [{owner: 'personId', id: 'petId'}]
      }]);
      var mainBody = {
        people: [{
          id: 'personId',
          pets: ['petId']
        }]
      };
      booster.mergeResults(req, linker, mainBody).then(function(merged){
        merged.people[0].id.should.equal('personId');
        merged.links["people.pets"].type.should.equal('pets');
        merged.linked.pets[0].id.should.equal('petId');
        done();
      });
    });
  });
};