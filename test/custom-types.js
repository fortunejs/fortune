'use strict';
var customTypesHelpers = require('../lib/custom-types');
var hooks = require('../lib/hooks');
var RSVP = require('rsvp');
var _ = require('lodash');
var sinon = require('sinon');
var should = require('should');
var fortune = require("../lib/fortune");
var mongoose = require("mongoose");

describe('custom-types util', function(){

  describe("Custom Types", function() {
    var sandbox;
    beforeEach(function(){
      sandbox = sinon.sandbox.create()
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe("Sandbox", function() {
      var app, modelStub;
      beforeEach(function() {
        app = fortune({ adapter: "mongodb" });
        sandbox.stub(app.adapter, "awaitConnection").returns(RSVP.resolve());
        modelStub = sandbox.stub(app.adapter, "model", function(name, schema) {
          if(!schema) return null;
          return {};
        });
      });
      it("should allow definition of a custom type", function() {
        app.customType("money");
      });
      it("should accept a user-facing schema for a custom type", function() {
        app.customType("money", {
          amount: Number,
          currency: String
        })._customTypes["money"].should.be.ok()
      });
      it("should allow usage of the custom type in any resource via string name", function() {
        app.customType("money", {
          amount: Number,
          currency: String
        });
        var flight = app.resource("flight", {
          price: 'money'
        });
        var schema = flight._resources["flight"].schema;
        schema.price.should.be.ok();
        schema.price.amount.should.eql(Number);
        schema.price.currency.should.eql(String);
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
              return function(req, res) { return this; }
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
            //Check beforeEach for this type def
            return hook.name == "distance-writemeter-distance";
          }).should.be.ok();

          _.find(hooks._after.read, function(hook) {
            return hook.name == "distance-readmeter-distance";
          }).should.be.ok();
        });

        it("should not hide any existing hooks", function() {
          app.customType("wtfmeter", {
            wtf: Number,
            ahas: Number
          }).beforeWrite([{
            name: "wtfwriter",
            init: function() {
              return function(req, res) {
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
            return hook.name == "wtfmeter-wtfwriter-wtf";
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
              return function(req, res) {
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
            wtfcurrent: "wtfmeter", //on go-around...
            wtf2end: "wtfmeter" //forget it
          });

          var hooks = app._resources["developer"].hooks;
          var wtf2end = _.find(hooks._before.write, function(hook) {
            return hook.name == "wtfmeter-wtfwriter-wtf2end";
          });
          var wtfcurrent = _.find(hooks._before.write, function(hook) {
            return hook.name == "wtfmeter-wtfwriter-wtfcurrent";
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
                return function(req, res) {
                  writewtf = this;
                  return RSVP.resolve({ wtf: 4, ahas: 2 });
                }
              }
            }]).afterRead([{
              name: 'readmeter',
              init: function() {
                return function(req, res) {
                  readwtf = this;
                  readwtf.ahas = readwtf.ahas + 1;
                  return RSVP.resolve(readwtf);
                }
              }
            }]);
            app.resource("developer", {
              wtfpersecond: 'wtfmeter'
            });
          });

          it("should bind the custom type's inner hooks to the data linked only, skipping entire resource", function() {
            var hook = _.find(app._resources["developer"].hooks._before.write, function(hook) {
              return hook && hook.name == "wtfmeter-writemeter-wtfpersecond";
            });
            hook.fn.call({ wtfpersecond: 3 }, {}, {}).then(function() {
              writewtf.should.eql(3);
            });
          });
          it("should set the linked data inside the resource to whatever custom data hooks return", function() {
            var hook = _.find(app._resources["developer"].hooks._before.write, function(hook) {
              return hook && hook.name == "wtfmeter-writemeter-wtfpersecond";
            });

            hook.fn.call({ wtfpersecond: { wtf: 3 }}, {}, {}).then(function(developer) {
              developer.should.eql({ wtfpersecond: { wtf: 4, ahas: 2 }})
            })
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
          });
          app._customTypes["wtfmeter"].should.be.ok();
        })
      });
    });

    describe("Test Drive", function() {
      var app, toDbFormatter, fromDbFormatter;
      before(function() {
        toDbFormatter = sinon.spy(function(){
          return this;
        });

        fromDbFormatter = sinon.spy(function(){
          return RSVP.resolve(this);
        });

        app = fortune({ adapter: "mongodb" });
        app.customType("money", {
          amount: Number,
          currency: String
        }).beforeWrite([{
          name: 'cast-to-db',
          init: function(){
            return toDbFormatter;
          }
        }]).afterRW([{
          name: 'card-from-db',
          init: function(){
            return fromDbFormatter;
          }
        }]);

        app.resource("flight", {
          price: 'money',
          airport: String
        }, {
          hooks: {}
        });
        return new RSVP.Promise(function(resolve){
          setTimeout(resolve, 1000); // awaitConnection
        });
      });
      afterEach(function(){
        toDbFormatter.reset();
        fromDbFormatter.reset();
      });

      it("should use provided schema underground", function() {
        return app.direct.create("flights", { body: { flights: [{ price: { amount: 1000, currency: "GBP" }}]}}).then(function(result) {
          result.body.flights[0].price.amount.should.eql(1000);
          result.body.flights[0].price.currency.should.eql("GBP")
        }).catch(function(err){
          console.error(err);
        });
      });
      it("should automatically convert data to appropriate format", function() {
        return app.direct.create("flights", { body: { flights: [{ price: { amount: "1000.0000", currency: "GBP" }}]}}).then(function(result) {
          result.body.flights[0].price.amount.should.eql(1000);
          result.body.flights[0].price.currency.should.eql("GBP")
        });
      });
      it("should support formatters returning promises", function(){
        return app.direct.create("flights", { body: { flights: [{ price: { amount: "1000.0000", currency: "GBP" }}]}}).then(function(result) {
          fromDbFormatter.callCount.should.equal(1);
          fromDbFormatter.calledOn({price: {amount: 1000, currency: "GBP"}}).should.be.ok;
        });
      });
      it("should support formatters returning plain results", function(){
        return app.direct.create("flights", { body: { flights: [{ price: { amount: "1000.0000", currency: "GBP" }}]}}).then(function(result) {
          toDbFormatter.callCount.should.equal(1);
          toDbFormatter.calledOn({price: {amount: "1000.0000", currency: "GBP"}}).should.be.ok;
        });
      });
      it("should not run custom-type formatter if type path does not exist in the body", function(){
        return app.direct.create("flights", {body: {flights: [{airport: 'STN'}]}}).then(function(){
          toDbFormatter.callCount.should.equal(0);
        });
      });
    });
  })

  describe('pullCustomTypePaths', function(){
    var types, type;
    beforeEach(function(){
      type = {
        hooks: ['hook'],
        schema: {}
      };
      types = {
        date: type
      };
    });
    it('should correctly identify custom-types paths in top-level keys', function(){
      var schema = {
        date: 'date'
      };
      customTypesHelpers.mapCustomTypes(schema, types).should.eql([
        {
          hooks: ['hook'],
          path: 'date',
          schema: {},
          type: type,
          typeId: 'date'
        }
      ]);
    });
    it('should correctly identify custom-types in embedded objects', function(){
      var schema = {
        nested: {
          date: 'date',
          a: {
            b: 'date'
          }
        }
      };
      customTypesHelpers.mapCustomTypes(schema, types).should.eql([
        {
          path: 'nested.date',
          hooks: ['hook'],
          schema: {},
          typeId: 'date',
          type: type
        },
        {
          path: 'nested.a.b',
          hooks: ['hook'],
          schema: {},
          typeId: 'date',
          type: type
        }
      ]);
    });
    it('should correctly identify custom-types in sub-docs', function(){
      var schema = {
        array: [
          {date: 'date'}
        ],
        reference: ['ref']
      };
      customTypesHelpers.mapCustomTypes(schema, types).should.eql([
        {
          path: 'array.0.date',
          hooks: ['hook'],
          schema: {},
          typeId: 'date',
          type: type
        }
      ]);
    });
    it('should not pick end schema path options as nested docuemnt', function(){
      var schema = {
        path: {
          type: String,
          default: 'whatever'
        }
      };

      (function(){
        customTypesHelpers.mapCustomTypes(schema, types).should.eql([]);
      }).should.not.throw();
    });
  });
  describe('rewriteSchemaPaths', function(){
    var paths, type;
    beforeEach(function(){
      type = {};
      paths = [];
    });
    it('should rewrite top-level types on schema', function(){
      var schema = {date: 'date'};
      paths.push({schema: type, path: 'date'});
      customTypesHelpers.rewriteSchema(schema, paths);
      schema.date.should.equal(type);
    });
    it('should rewrite nested object types on schema', function(){
      var schema = {nested: {date: 'date'}};
      paths.push({schema: type, path: 'nested.date'});
      customTypesHelpers.rewriteSchema(schema, paths);
      schema.nested.date.should.equal(type);
    });
    it('should rewrite embedded documents types on schema', function(){
      var schema = {array: [{date: 'date'}]};
      paths.push({schema: type, path: 'array.0.date'});
      customTypesHelpers.rewriteSchema(schema, paths);
      schema.array[0].date.should.equal(type);
    });
  });
  describe('applyHook', function(){
    var fn, doc, type, req, res;
    beforeEach(function(){
      fn = sinon.stub();
      _.range(10).forEach(function(i) { fn.onCall(i).returns(i);});

      doc = {
        top: 'a'
      };
      type = {};
      req = {};
      res = {};
    });
    it('should apply hook fn to correct path', function(){
      return customTypesHelpers.applyHook(fn, 'top', doc, req, res).then(function(){
        fn.callCount.should.equal(1);
        fn.getCall(0).args[0].should.equal(req);
        fn.getCall(0).args[1].should.equal(res);
        doc.top.should.equal(0);
      });
    });
    it('should apply hook fn to all items of embedded array', function(){
      doc = {array: [
        {top: 'a'},
        {top: 'b'}
      ]};

      return customTypesHelpers.applyHook(fn, 'array.0.top', doc, req, res).then(function(){
        fn.callCount.should.equal(2);

        doc.array[0].should.eql({top: 0});
        fn.getCall(0).args[0].should.equal(req);
        fn.getCall(0).args[1].should.equal(res);

        doc.array[1].should.eql({top: 1});
        fn.getCall(1).args[0].should.equal(req);
        fn.getCall(1).args[1].should.equal(res);
      });
    });
    it('shoud apply hook to correct nested document branch', function(){
      doc = {
        nested: {
          second: {
            top: 'a'
          }
        }
      };

      return customTypesHelpers.applyHook(fn, 'nested.second.top', doc, req, res).then(function(){
        fn.callCount.should.equal(1);

        doc.nested.second.top.should.equal(0);
      });

    });
    it('gets fancy', function(){
      doc = {
        top: 'a',
        nested: {
          top: 'a'
        },
        array: [{
          one: [{two: {three: 'b'}}]
        }]
      };

      var paths = [
        'top',
        'nested.top',
        'array.0.one.0.two.three'
      ];

      return RSVP.all(paths.map(function(path){
        return customTypesHelpers.applyHook(fn, path, doc, req, res);
      })).then(function(){
        doc.should.eql({
          top: 0,
          nested: {top: 1},
          array: [{
            one: [{
              two: {three: 2}
            }]
          }]
        });
      });
    });
  });
  it('gets fancy', function(){
    var schema = {
      a: 'date',
      b: {c: {d: {e: 'date'}}},
      f: [{g: {h: [{i: 'date'}]}}]
    };
    var date = {};
    var types = {
      date: {schema: date}
    };
    var config = customTypesHelpers.mapCustomTypes(schema, types);
    console.log(config);
    customTypesHelpers.rewriteSchema(schema, config);
    schema.a.should.equal(date);
    schema.b.c.d.e.should.equal(date);
    schema.f[0].g.h[0].i.should.equal(date);
  });
});