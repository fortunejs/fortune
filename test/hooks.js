var should = require('should');
var RSVP = require('rsvp');
var hooks = require('../lib/hooks');
var crypto = require('crypto');

var synchronousHook = [{
  name: 'syncHook',
  config: {
    a: 10
  },
  init: function(hookConfig, fortuneConfig){
    var a = hookConfig.a;
    var b = (fortuneConfig.options && fortuneConfig.options.b) || 100;
    return function(req, res){
      this.hooked = a + b;
      return this;
    }
  }
}];

describe('hooks', function(){
  it('should keep track of registered hooks', function(done){
    hooks.registerGlobalHook('_before', 'read', synchronousHook);
    should.exist(hooks._hooksAll._before.read[0]);
    done();
  });
  it('should be able to extend global hook config along with registration', function(done){
    hooks.registerGlobalHook('_after', 'write', synchronousHook, {syncHook: {a: 500}});
    synchronousHook[0].config.a.should.equal(10);
    var resourceConfig = {};
    hooks.initGlobalHooks(resourceConfig, {});
    resourceConfig.hooks._after.write[0].call({}).should.eql({hooked: 600});
    done();
  });
  it('inline config should not break default hook configuration', function(done){
    hooks.registerGlobalHook('_after', 'write', synchronousHook, {syncHook: {a: 500}});
    synchronousHook[0].config.a.should.equal(10);
    hooks.registerGlobalHook('_before', 'read', synchronousHook, {syncHook: {a: 600}});
    synchronousHook[0].config.a.should.equal(10);
    done();
  });
  it('should be able to apply registered hooks to provided resource', function(done){
    hooks.registerGlobalHook('_before', 'read', synchronousHook);
    var resourceConfig = {};
    hooks.initGlobalHooks(resourceConfig, {});
    should.exist(resourceConfig.hooks);
    (resourceConfig.hooks._before.read[0]).should.be.a.Function;
    done();
  });
  it('should be configurable', function(done){
    hooks.registerGlobalHook('_before', 'read', synchronousHook);
    var resourceConfig = {
      hooksOptions: {
        syncHook: {
          a: 1
        }
      }
    };
    var resource = {};
    hooks.initGlobalHooks(resourceConfig, {options: {b: 2}});
    resourceConfig.hooks._before.read[0].call(resource);
    (resource.hooked).should.equal(3);
    done();
  });
  it('should be possible to disable specific hook in resource config', function(done){
    hooks.registerGlobalHook('_before', 'read', synchronousHook);
    var resourceConfig = {
      hooksConfig: {
        syncHook: {
          disable:  true
        }
      }
    };
    hooks.initGlobalHooks(resourceConfig, {});
    should.not.exist(resourceConfig.hooks[0]);
    done();
  });
  it('should apply default hook config if resource does not provide one', function(done){
    hooks.registerGlobalHook('_before', 'read', synchronousHook);
    var resourceConfig = {};
    var resource = {};
    hooks.initGlobalHooks(resourceConfig, {});
    should.exist(resourceConfig.hooks._before.read[0]);
    resourceConfig.hooks._before.read[0].call(resource);
    (resource.hooked).should.equal(110);
    done();
  });
  it('warning should not affect other hooks', function(done){
    var fortune = {
      _resources: {
        defined: {}
      },
      options: {}
    };
    (function(){
      hooks.addHook.call(fortune, 'undefined defined', synchronousHook, '_before', 'read');
    }).should.not.throw();
    should.exist(fortune._resources.defined.hooks._before.read);
    done();
  });
  describe('integration with fortune', function(){
    var fortune;
    beforeEach(function(){
      fortune = {
        _resource: "person",
        _resources: {
          person: {
            hooksOptions: {
              syncHook:{
                a: 1
              }
            }
          },
          pet: {}
        },
        options: {
          b: 2
        }
      };
    });
    it('should provide method to register a hook for selected resource', function(done){
      hooks.addHook.call(fortune, 'person', synchronousHook, '_after', 'read');
      (fortune._resources.person.hooks._after.read.length).should.equal(1);
      done();
    });
    it('should be backward compatible', function(done){
      var mockHook = function(req, res){
        return 'Hello world';
      };
      hooks.addHook.call(fortune, 'person', mockHook, '_before', 'write');
      var generatedHook = fortune._resources.person.hooks._before.write[0];
      should.exist(generatedHook);
      (generatedHook()).should.equal('Hello world');
      done();
    });
    it('should be possible to provide space-separated names of resources to apply hooks to', function(done){
      hooks.addHook.call(fortune, 'person pet', synchronousHook, '_after', 'write');
      var personHook = fortune._resources.person.hooks._after.write[0];
      var petHook = fortune._resources.pet.hooks._after.write[0];
      should.exist(personHook);
      should.exist(petHook);
      var person = {};
      personHook.call(person);
      //Options are defined in hook config and fortune config
      (person.hooked).should.equal(3);
      var pet = {};
      petHook.call(pet);
      //Options are defined only in fortune config
      (pet.hooked).should.equal(12);
      done();
    });
    it('hooks should be provided with full fortune instance', function(done){
      var mock = [{
        name: "mock",
        init: function(config, fortune){
          should.exist(fortune);
          (fortune._resource).should.equal('person');
          (fortune._resources).should.be.an.Object;
          done();
          //Hook must return a function
          return function(){}
        }
      }];
      hooks.addHook.call(fortune, 'person', mock, '_after', 'write');
    });
  });
});