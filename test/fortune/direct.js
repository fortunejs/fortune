var _ = require("lodash"),
    should = require("should");

module.exports = function(options){
  describe("direct", function(){
    var app, ids;
    
    beforeEach(function(){
      app = options.app;
      ids = options.ids;
    });

    it("gets a resource collection", function(done){
      app.direct.get("people").then(function(body){
        ids.people.forEach(function(id){
          _.contains(_.pluck(body.people, 'id'), id).should.equal(true);
        });
        done();
      });
    });

    it("gets a single resource", function(done){
      app.direct.get("people", ids.people[0]).then(function(body){
        body.people.length.should.be.equal(1);
        body.people[0].id.should.equal(ids.people[0]);
        done();
      }).catch(function(err){ console.trace(err); });;
    });

    it("gets a number of resources by ids", function(done){
      app.direct.get("people", ids.people).then(function(body){
        _.each(ids.people, function(id){
          _.contains(_.pluck(body.people, "id"),id).should.be.true;
        });
        done();
      });
    });

    it("deletes a collection", function(done){
      app.direct.get("people").then(function(body){
        body.people.length.should.be.above(1);
      }).then(function(){
        return app.direct.destroy("people");
      }).then(function(){
        return app.direct.get("people");
      }).then(function(body){
        body.people.length.should.be.equal(0);
        done();
      });
    });

    it("creates a resource", function(done){
      var res = { name: "Director", email: "director@abc.com" };
      app.direct.create("people", res).then(function(body){
        body.people.length.should.be.equal(1);
        body.people[0].id.should.be.equal(res.email);
        return app.direct.get("people", res.email);
      }).then(function(body){
        body.people[0].id.should.be.equal(res.email);
        done();
      });
    });

    it("replaces a resource", function(done){
      var resource;

      app.direct.get("people",ids.people[0]).then(function(body){
        resource = body.people[0];
        resource.birthday = null;
        resource.email = "abc@xyz.com";
        resource.nickname = "udpated";
        return app.direct.replace("people", resource.id, resource);
      }).then(function(body){
        should.not.exist(body.error);
        body.people[0].id.should.be.equal(resource.email);
        return app.direct.get("people", resource.email);
      }).then(function(body){
        body.people[0].id.should.be.equal(resource.email);
        done();
      }).catch(function(err){ console.trace(err); });
    });

    describe("update", function(){
      it("adds a record to an array", function(done){
        app.direct.update("people", ids.people[0], [{
          op: "add",
          path: "/people/0/houses/-",
          value: ids.houses[1]
        }]).then(function(body){
          body.people[0].links.houses.length.should.equal(1);
          body.people[0].links.houses[0].should.equal(ids.houses[1]);
          done();
        });
      });

      it("supports bulk update", function(done){
        app.direct.update("people", ids.people[0], [{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[0]
        },{
          op: 'add',
          path: '/people/0/houses/-',
          value: ids.houses[1]
        }]).then(function(body){
          body.people[0].links.houses.length.should.equal(2);
          done();
        });
      });
    });
  });
};
