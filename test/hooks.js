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
    var b = fortuneConfig.b || 100;
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
  it('should be able to apply registered hooks to provided resource', function(done){
    var resourceConfig = {};
    hooks.initGlobalHooks(resourceConfig, {});
    should.exist(resourceConfig.hooks);
    (resourceConfig.hooks._before.read[0]).should.be.a.Function;
    done();
  });
  it('should be configurable', function(done){
    var resourceConfig = {
      hooksOptions: {
        syncHook: {
          a: 1
        }
      }
    };
    var resource = {};
    hooks.initGlobalHooks(resourceConfig, {b: 2});
    resourceConfig.hooks._before.read[0].call(resource);
    (resource.hooked).should.equal(3);
    done();
  });
  it('should be possible to disable specific hook in resource config', function(done){
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
    var resourceConfig = {};
    var resource = {};
    hooks.initGlobalHooks(resourceConfig, {});
    should.exist(resourceConfig.hooks._before.read[0]);
    resourceConfig.hooks._before.read[0].call(resource);
    (resource.hooked).should.equal(110);
    done();
  });
  describe('integration with fortune', function(){
    var fortune;
    beforeEach(function(){
      fortune = {
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
  });
});