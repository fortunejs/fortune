var Mocha = require('mocha')
  , path = require('path')
  , _ = require('lodash')
  , RSVP = require('rsvp')
  , request = require('supertest')
  , fixtures = require('./fixtures.json')
  , location = path.normalize(__dirname);

if(!process.env.TRAVIS) {
  var config = {};
  config[process.argv[2] || 'nedb'] = 8890;
  runTests(config);
} else {
  runTests({
    nedb: 8890,
    mongodb: 8891
    //mysql: 8892
  });
}

function runTests(adapters) {
  global.adapters = adapters;
  var apps = [];

  _.each(adapters, function(port, adapter) {

    // test application
    var options = {
      adapter: adapter,
      db: 'fortune_test'
    };

    if(adapter == 'mysql') {
      if(process.env.TRAVIS) {
        options.username = 'travis';
        options.password = '';
      }
    }

    apps.push(require('./app')(adapter, options, port));

  });

  RSVP.all(apps.map(function(app) {
    return app.adapter.awaitConnection();
  })).then(function() {

    new Mocha()
      .reporter('spec')
      .ui('bdd')
      .addFile(path.join(location, 'all.js'))
      .run(function(code) {
        process.exit(code);
      });

  });

}

module.exports = runTests;
