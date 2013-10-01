var Mocha = require('mocha')
  , path = require('path')
  , _ = require('lodash')
  , RSVP = require('rsvp')
  , request = require('supertest')
  , fixtures = require('./fixtures.json')
  , location = path.normalize(__dirname);

testAdapter(process.argv[2] || 'nedb');

function testAdapter(adapter) {

  // test application
  var options = {
    adapter: adapter,
    db: 'fortune_test'
  };
  if(adapter == 'mysql') {
    if(process.env.TRAVIS) {
      options.username = 'travis';
      options.password = '';
    } else {
      process.exit();
    }
  } else if(adapter == 'mongodb') {
    if(!process.env.TRAVIS) process.exit();
  }

  var port = 8890
    , app = require('./app')(adapter, options, port)
    , createResources = [];

  /*!
   * This is ugly, but the reason behind it is that
   * there is no way to defer test runner execution.
   */
  global.adapter = adapter;
  global.baseUrl = 'http://localhost:' + port;
  global._ids = {};

  app.adapter.awaitConnection().then(function() {

    _.each(fixtures, function(resources, collection) {
      createResources.push(new RSVP.Promise(function(resolve, reject) {
        var body = {};
        body[collection] = resources;
        request(app.router)
          .post('/' + collection)
          .send(body)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(error, response) {
            if(error) return reject(error);
            var resources = JSON.parse(response.text)[collection];
            global._ids[collection] = global._ids[collection] || [];
            resources.forEach(function(resource) {
              global._ids[collection].push(resource.id);
            });
            resolve();
          });
      }));
    });

    return RSVP.all(createResources);

  })

  .then(function() {
    var options = {};
    if(process.env.TRAVIS) {
      options.bail = true;
    }

    return new Mocha(options)
      .reporter('spec')
      .ui('bdd')
      .addFile(path.join(location, 'all.js'))
      .run(function(code) {
        process.exit(code);
      });

  });

}
