var _ = require("lodash"),
    sinon = require("sinon"),
    should = require("should");

module.exports = function(options){
  describe("direct", function(){
    var app, ids;

    beforeEach(function(){
      app = options.app;
      ids = options.ids;
    });

    it("gets a resource collection", function(done){
      app.direct.get("people").then(function(res){
        ids.people.forEach(function(id){
          _.contains(_.pluck(res.body.people, 'id'), id).should.equal(true);
        });
        done();
      });
    });

    it("gets a single resource", function(done){
      app.direct.get("people", {params: { id:ids.people[0] }}).then(function(res){
        res.body.people.length.should.be.equal(1);
        res.body.people[0].id.should.equal(ids.people[0]);
        done();
      }).catch(function(err){ console.trace(err); });;
    });

    it("gets a number of resources by ids", function(done){
      app.direct.get("people", {id:ids.people}).then(function(res){
        _.each(ids.people, function(id){
          _.contains(_.pluck(res.body.people, "id"),id).should.be.true;
        });
        done();
      });
    });

    it("deletes a collection", function(done){
      app.direct.get("people").then(function(res){
        res.body.people.length.should.be.above(1);
      }).then(function(){
        return app.direct.destroy("people");
      }).then(function(){
        return app.direct.get("people");
      }).then(function(res){
        res.body.people.length.should.be.equal(0);
        done();
      });
    });

    it("creates a resource", function(done){
      var doc = {people: [{ name: "Director", email: "director@abc.com" }]};

      app.direct.create("people", {body:doc}).then(function(res){
        res.body.people.length.should.be.equal(1);
        res.body.people[0].id.should.be.equal(doc.people[0].email);
        return app.direct.get("people", {params: {id:doc.people[0].email}});
      }).then(function(res){
        res.body.people[0].id.should.be.equal(doc.people[0].email);
        done();
      });
    });

    it("replaces a resource", function(done){
      var resource, id;

      app.direct.get("people",{params: {id:id = ids.people[0]}}).then(function(res){
        resource = res.body.people[0];
        resource.birthday = null;
        resource.email = "abc@xyz.com";
        resource.nickname = "udpated";
        return app.direct.replace("people", {params: {id:id}, body:{people: [resource]}});
      }).then(function(res){
        should.not.exist(res.body.error);
        res.body.people[0].id.should.be.equal(resource.email);
        return app.direct.get("people", {params: {id: resource.email}});
      }).then(function(res){
        res.body.people[0].id.should.be.equal(resource.email);
        done();
      }).catch(function(err){ console.trace(err.stack || err); });
    });

    it("udpate can add a record to an array", function(done){
      app.direct.update("people", {params: {id: ids.people[0]}, body:[{
        op: "add",
        path: "/people/0/links/houses/-",
        value: ids.houses[1]
      }]}).then(function(res){
        res.body.people[0].links.houses.length.should.equal(1);
        res.body.people[0].links.houses[0].should.equal(ids.houses[1]);
        done();
      });
    });

    it("supports bulk update", function(done){
      app.direct.update("people", {params: {id: ids.people[0]}, body:[{
        op: 'add',
        path: '/people/0/links/houses/-',
        value: ids.houses[0]
      },{
        op: 'add',
        path: '/people/0/links/houses/-',
        value: ids.houses[1]
      }]}).then(function(res){
        res.body.people[0].links.houses.length.should.equal(2);
        done();
      });
    });

    it("supports filters", function(done){
      app.direct.get("people", {query: {filter: {name: "Robert"}}}).then(function(res){
        res.body.people.length.should.equal(1);
        res.body.people[0].name.should.be.equal("Robert");
        done();
      });
    });

    it("supports includes", function(done){
      app.direct.update("people", {params: {id: ids.people[0]}, body: [{
        op: "add",
        path: "/people/0/links/houses/-",
        value: ids.houses[1]
      }]}).then(function(){
        return app.direct.get("people", {query: {include: "houses"}});
      }).then(function(res){
        res.body.linked.should.be.an.Object;
        res.body.linked.houses.length.should.equal(1);
        res.body.linked.houses[0].id.should.equal(ids.houses[1]);
        done();
      });
    });

    it("should provide httpMethod for hooks that inspect it", function(done){
      app.direct.update("people", {params: {id: ids.people[0]}, body: [{
        op: "add", path: "/people/0/links/houses/-", value: ids.houses[0]
      }]}).then(function(res){
        res.headers["hookedmethod"].should.equal("PATCH");
        done();
      });
    });
  });
};
