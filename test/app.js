var fortune = require('../lib/fortune');
var personHooks = require('./personHooks');

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

  if (app.adapter.mongoose) {
    app.adapter.awaitConnection().then(function() {
      console.log('Dropping database');
      app.adapter.mongoose.connections[1].db.dropDatabase();
    }, function(err){ console.trace(err); });
  }

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

  return app
  .beforeAll(hooks.beforeAll)
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
    email: String,
    pets: ['pet'],
    soulmate: {ref: 'person', inverse: 'soulmate', type: String},
    lovers: [{ref: 'person', inverse: 'lovers', type: String}],
    externalResources: [{ ref: "externalResourceReference", type: String, external: true }],
    cars: [{ref:'car', type: String}]
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
    res.setHeader('before', 'called for both reads and writes');
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
    res.setHeader('after', 'called for both reads and writes');
    delete this.password;
    this.nickname = 'Super ' + this.name;
    return this;
  })

  .after('person',[{
    name: 'secondLegacyAfter',
    init: function() {
      return function(){
        this.nickname = this.nickname + '!';
        return this;
      }
    }
  }])

  .listen(port);

};


