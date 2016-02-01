var _ = require("lodash"),
    sinon = require("sinon"),
    should = require("should"),
    fortune = require("../../lib/fortune"),
    RSVP = require('rsvp'),
    mongoose = require("mongoose");

describe("Fortune", function() {
  describe("Custom Types", function(){
    var sandbox, app, modelStub;
    beforeEach(function(){
      sandbox = sinon.sandbox.create()
      app = fortune();
      sandbox.stub(app.adapter, "awaitConnection").returns(RSVP.resolve());
      modelStub = sandbox.stub(app.adapter, "model", function(name, schema) {
        if(!schema) return null;
        return {};
      })
    });
    afterEach(function() {
      sandbox.restore();
    });

    it("should allow definition of a custom type", function() {
      app.customType("distance");
    });
    it("should accept a user-facing schema for a custom type", function() {
      app.customType("distance", {
        km: Number,
        m: Number,
        pc: Number
      })._customTypes["distance"].should.be.ok() 
    });
    it("should allow usage of the custom type in any resource via string name", function() {
      app.customType("distance", {
        km: Number,
        m: Number,
        pc: Number
      });
      var flight = app.resource("flight", {
        distance: 'distance'
      });
      var schema = flight._resources["flight"].schema;
      schema.distance.should.be.ok()
      schema.distance.km.should.be.ok()
      schema.distance.m.should.be.ok()
      schema.distance.pc.should.be.ok()
    });

    describe("Hooks", function() {
      beforeEach(function() {
        app.customType("distance", {
          km: Number,
          m: Number,
          pc: Number
        }).beforeWrite([{
          name: 'writemeter',
          init: function() {
            return function(res, res) { return this; }
          }
        }]).afterRead([{
          name: 'readmeter',
          init: function() {
            return function(req, res) { return this; }
          }
        }]);
      });

      it("should accept a hook for a custom type", function() {
        app._customTypes["distance"].should.be.ok();
      });

      it("should inject all the hooks to provided resource", function() {
        app.resource("flight", {
          distance: 'distance'
        });

        var hooks = app._resources["flight"].hooks;

        _.find(hooks._before.write, function(hook) {
          return hook.name.match(/writemeter/)
        }).should.be.ok()

        _.find(hooks._after.read, function(hook) {
          return hook.name.match(/readmeter/)
        }).should.be.ok()
      });

      it("should make hook name unique by adding field name to it", function() {
        app.resource("flight", {
          distance: 'distance'
        });

        var hooks = app._resources["flight"].hooks;

        _.find(hooks._before.write, function(hook) {
          return hook.name == "distance-writemeter";
        }).should.be.ok()

        _.find(hooks._after.read, function(hook) {
          return hook.name == "distance-readmeter";
        }).should.be.ok()
      });

      it("should not hide any existing hooks", function() {
        app.customType("wtfmeter", {
          wtf: Number,
          ahas: Number
        }).beforeWrite([{
          name: "wtfwriter",
          init: function() {
            return function(res, res) {
              return { wtf: 4, ahas: 2 };
            }
          }
        }]).afterRead([{
          name: "wtfreader",
          init: function() {
            return function(req, res) {
              return this;
            }
          }
        }]);

        app.resource("developer", {
          wtf: "wtfmeter"
        }).beforeWrite([{
          name: "kick",
          init: function() {
            return function(req, res) {
              return this;
            }
          }
        }]);
        var hooks = app._resources["developer"].hooks;
        var wtfwriter = _.find(hooks._before.write, function(hook) {
          return hook.name == "wtf-wtfwriter";
        });
        var kick = _.find(hooks._before.write, function(hook) {
          return hook.name == "kick";
        });

        wtfwriter.should.be.ok();
        kick.should.be.ok();
      });

      it("should inject entire hook set for each field in a resource using the custom type", function() {
        app.customType("wtfmeter", {
          wtf: Number,
          ahas: Number
        }).beforeWrite([{
          name: "wtfwriter",
          init: function() {
            return function(res, res) {
              return { wtf: 4, ahas: 2 };
            }
          }
        }]).afterRead([{
          name: "wtfreader",
          init: function() {
            return function(req, res) {
              return this;
            }
          }
        }]);

        app.resource("developer", {
          wtfcurrent: "wtfmeter",
          wtf2end: "wtfmeter"
        });

        var hooks = app._resources["developer"].hooks;
        var wtf2end = _.find(hooks._before.write, function(hook) {
          return hook.name == "wtf2end-wtfwriter";
        });
        var wtfcurrent = _.find(hooks._before.write, function(hook) {
          return hook.name == "wtfcurrent-wtfwriter";
        });

        wtf2end.should.be.ok()
        wtfcurrent.should.be.ok()
      });

      describe("linked data", function() {
        var writewtf, readwtf;
        beforeEach(function() {
          app.customType("wtfmeter", {
            wtf: Number,
            ahas: Number
          }).beforeWrite([{
            name: 'writemeter',
            init: function() {
              return function(res, res) {
                writewtf = this;
                return { wtf: 4, ahas: 2 };
              }
            }
          }]).afterRead([{
            name: 'readmeter',
            init: function() {
              return function(req, res) {
                readwtf = this;
                return this;
              }
            }
          }]);
          app.resource("developer", {
            wtfpersecond: 'wtfmeter'
          });
        });

        it("should bind the custom type's inner hooks to the data linked only, skipping entire resource", function() {
          var hook = _.find(app._resources["developer"].hooks._before.write, function(hook) {
            return hook && hook.name == "wtfpersecond-writemeter";
          });
          hook.fn.call({ wtfpersecond: 3 }, {}, {})
          writewtf.should.eql(3);
        });
        it("should set the linked data inside the resource to whatever custom data hooks return", function() {
          var hook = _.find(app._resources["developer"].hooks._before.write, function(hook) {
            return hook && hook.name == "wtfpersecond-writemeter";
          });

          var developer = hook.fn.call({ wtfpersecond: { wtf: 3 }}, {}, {})
          developer.should.eql({ wtfpersecond: { wtf: 4, ahas: 2 }})
        });
      });
    });

    describe("Database Schema", function() {
      it("should be accepted", function() {
        app.customType("wtfmeter", {
          wtf: Number,
          ahas: Number
        }, {
          dbschema: {
            wtfahas: String
          }
        });
        app._customTypes["wtfmeter"].should.be.ok()
        app._customTypes["wtfmeter"].dbschema.should.eql({ wtfahas: String });
      })
      it("should be optional", function() {
        app.customType("wtfmeter", {
          wtf: Number,
          ahas: Number
        })
        app._customTypes["wtfmeter"].should.be.ok();
      })
      it("should be mongoose.Schema.Types.Mixed if not specified", function(done) {
        app.customType("wtfmeter", {
          wtf: Number,
          ahas: Number
        }, {
          dbschema: {
            pooo: String
          }
        });
        app.resource("monkey", {
          wtf: "wtfmeter"
        });

        setTimeout(function() {
          modelStub.getCall(1).should.be.ok()
          modelStub.getCall(1).args[1].tree.wtf.should.eql(mongoose.Schema.Types.Mixed)
          done();
        }, 1000);
        
      });
      it("should rise an error if db schema specified and violated");
    });
  })
});
