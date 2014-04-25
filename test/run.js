var Mocha = require('mocha');
var path = require('path');
var _ = require('lodash');
var RSVP = require('rsvp');

var location = path.normalize(__dirname);

global.options = {};

if (!process.env.TRAVIS) {
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
  var apps = [];

  _.each(adapters, function (port, adapter) {

    // test application
    var options = {
      adapter: adapter,
      db: 'fortune_test',
      inflect: true
    };

    if (adapter == 'mysql') {
      if (process.env.TRAVIS) {
        options.username = 'travis';
        options.password = '';
      }
    }

    global.options[port] = options;

    apps.push(require('./app')(options, port));

  });

  RSVP.all(apps.map(function (app) {
    return app.adapter.awaitConnection();
  })).then(function () {

    new Mocha()
      .reporter('spec')
      .ui('bdd')
      .addFile(path.join(location, 'all.js'))
      .run(function (code) {
        process.exit(code);
      });

  });

}

module.exports = runTests;
