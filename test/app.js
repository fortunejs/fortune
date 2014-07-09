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

  app.adapter.awaitConnection().then(function(){
    return new RSVP.Promise(function(resolve){
      app.adapter.mongoose.connections[1].db.collectionNames(function(err, collections){
        resolve(_.compact(_.map(collections, function(collection){
          
          var name = collection.name.split(".")[1];
          if(name && name !== "system"){
            return new RSVP.Promise(function(resolve){
              app.adapter.mongoose.connections[1].db.collection(name, function(err, collection){
                collection.remove({},null, function(){
                  console.log("Wiped collection", name);
                  resolve();
                });
              });
            });
          }
          return null;
        })));
      });
    });
  }).then(function(wipeFns){
    console.log("Wiping collections:");
    return RSVP.all(wipeFns);
  }).then(function(){
    app.router.post("/remove-pets-link/:personid", function(req, res) {
      var Person = app.adapter.model("person");
      Person.findOne({email: req.params.personid}, function(err,person) {
        if (err) {
          console.error(err);
          res.send(500,err);
          return;
        }
        person.pets = null;
        person.save(function() {
          res.send(200);
        });
      });

    });
  });

  

  
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
      cars: [{ref:'car', type: String}],
      houses: [{ref: 'house', inverse: 'owners'}],
      estate: {ref: 'house', inverse: 'landlord'}
    }, {
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
      owner: {ref:'person', type: String}
    })


    .resource('car', {
      licenseNumber: String,
      model: String,
      owner: {ref:'person', type: String},
      MOT: {ref: 'service', external: true, type: String},
      additionalDetails: {
        seats: Number
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


