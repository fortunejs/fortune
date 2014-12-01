var fortune = require('../lib/fortune');
var personHooks = require('./personHooks');
var _ = require("lodash");
var RSVP = require("rsvp");
var mongoosePlugin = require('./mongoose_middleware');

var hooks = {};

['beforeAll', 'beforeAllRead', 'beforeAllWrite', 'afterAll', 'afterAllRead', 'afterAllWrite'].forEach(function(type){
  hooks[type] = [{
    name: type,
    config: {
      option: type
    },
    init: function(hookOptions, fortuneOptions){
      return function(req, res){
        res.setHeader(hookOptions.option, '1');

        if (req.query['fail' + type]) {
          console.log('Failing hook',type);
          _.defer(function() {
            res.send(321);
          });
          if (req.query['fail' + type] === 'boolean')
            return false;
          else
            return new RSVP.Promise(function(resolve) { resolve(false); });
        }

        return this;
      };
    }
  }]
});

var Hook = function(hookConfig, fortuneConfig){
  return function(req, res){
    res.setHeader(hookConfig.header, hookConfig.value);
    return this;
  }
};

module.exports = function(options, port) {
  var app = fortune(options);

  app.inflect.inflections.plural("MOT", "MOT");

  app.beforeAllRW([{
    name: "by5",
    priority: 10,
    init: function(){
      return function(req, res){
        res.setHeader("globalPriority", (res.get("globalPriority") || "") + "rect");
        res.setHeader("hookedmethod", req.method);
        return this;
      }
    }
  },{
    name: "by3",
    priority: 20,
    init: function(){
      return function(req, res){
        res.setHeader("globalPriority", (res.get("globalPriority") || "") + "cor");
        return this;
      }
    }
  }]);


  return app.beforeAll(hooks.beforeAll)
    .beforeAllRead(hooks.beforeAllRead)
    .beforeAllWrite(hooks.beforeAllWrite)
    .afterAll(hooks.afterAll)
    .afterAllRead(hooks.afterAllRead)
    .afterAllWrite(hooks.afterAllWrite)

    .resource('person', {
      name: String,
      official: String,
      password: String,
      appearances: Number,
      birthday: Date,
      email: {type: String},
      pets: ['pet'],
      soulmate: {ref: 'person', inverse: 'soulmate', type: String},
      lovers: [{ref: 'person', inverse: 'lovers', type: String}],
      externalResources: [{ ref: "externalResourceReference", type: String, external: true }],
      cars: [{ref:'car', inverse: 'owner', type: String}],
      houses: [{ref: 'house', inverse: 'owners'}],
      addresses: [{ref: 'address', inverse: 'person'}],
      estate: {ref: 'house', inverse: 'landlord'},
      nested: {
        field1: String,
        field2: String
      },
      upsertTest : String
    }, {
      upsertKeys: ["upsertTest"],
      model: {pk:"email"},
      hooks: {
        beforeAll:{
          option: 'beforeAllPeople'
        },
        afterAllRead: {
          option: 'afterAllReadPeople'
        },
        afterRead: {
          header: 'afterReadPerson',
          value: 'ok'
        }
      }
    })
    .beforeRead([{
      name: 'modifyFilter',
      init: function(){
        return function(req, res){
          if (req.headers['hookfilter']){
            req.query.filter = {};
            req.query.filter.id = req.headers['hookfilter'];
          }
          return this;
        }
      }
    }])

  //Hooks with standard config defined in personHooks.js
    .beforeWrite([personHooks.beforeWrite])
    .afterWrite([personHooks.afterWrite])
  //A hook with overridden config in person resource configuration
    .afterRead([personHooks.afterRead])
  //Hooks with config passed along
    .beforeRead([personHooks.readFirst, personHooks.readSecond], {
      readFirst: {
        header: 'beforeReadFirst'
      },
      readSecond: {
        header: 'beforeReadSecond'
      }
    })

    .resource('house', {
      address: String,
      owners: [{ref: 'person', inverse: 'houses', pkType: String}],
      landlord: {ref: 'person', inverse: 'estate', pkType: String}
    }, null, function(schema){
      schema.plugin(mongoosePlugin, {paths: ['address']});
    })
    .resource('pet', {
      name: String,
      appearances: Number,
      owner: {ref:'person', inverse: 'pets', type: String}
    })

    .resource('address', {
      name: String,
      person: {ref: 'person', inverse: 'addresses', pkType: String}
    })


    .resource('car', {
      licenseNumber: String,
      model: String,
      owner: {ref:'person', inverse: 'cars', type: String},
      MOT: {ref: 'service', external: true, type: String},
      additionalDetails: {
        seats: Number,
        wheels: Number
      }
    },{
      model: { pk: "licenseNumber" },
      hooks: {
        afterAll: {
          disable: true
        }
      }
    })

    .before('person', function(req, res){
      this.password = Math.random();
      this.official = 'Mr. ' + this.name;
      res.setHeader('before', 'called for writes only');
      return this;
    })

    .before('person pet', function(req, res){
      if (this.email === 'falsey@bool.com'){
        res.send(321);
        return false;
      }
      return this;
    })

    .beforeRead('pet', [{
      name: 'petHook',
      config: {
        header: 'petHook',
        value: 'ok'
      },
      init: Hook
    }])
    .beforeRead('house', [{
      name: 'div5',
      priority: 10,
      init: function(){
        return function(req, res){
          res.setHeader("resourcePriority", (res.get("resourcePriority") || "")  + "rect");
          return this;
        }
      }
    },{
      name: 'div3',
      priority: 20,
      init: function(){
        return function(req, res){
          res.setHeader("resourcePriority", (res.get("resourcePriority") || "") + "cor");
          return this;
        }
      }
    }])
    .beforeRead('pet', [{
      name: 'async1',
      priority: 3,
      init: function(){
        return function(req, res){
          var self = this;
          var d = RSVP.defer();
          setImmediate(function(){
            res.setHeader("asyncseries", (res.get("asyncseries") || "") +  "cor");
            d.resolve(self);
          });
          return d.promise;
        }
      }
    },{
        name: 'async2',
        priority: 2,
        init: function(){
          return function(req, res){
            var self = this;
            var d = RSVP.defer();
            setImmediate(function(){
              res.setHeader("asyncseries", (res.get("asyncseries") || "") + "re");
              d.resolve(self);
            });
            return d.promise;
          }
        }
    },{
      name: 'async3',
      priority: 1,
      init: function(){
        return function(req, res){
          res.setHeader("asyncseries", (res.get("asyncseries") || "") + "ct");
          return this;
        }
      }
    }])

    .after('person', function(req, res) {
      res.setHeader('after', 'called for reads only');
      delete this.password;
      this.nickname = 'Super ' + this.name;
      return this;
    })

    .afterRW('person',[{
      name: 'secondLegacyAfter',
      init: function() {
        return function(){
          this.nickname = this.nickname + '!';
          return this;
        };
      }
    }])
    .listen(port);
};


