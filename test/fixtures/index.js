var _ = require('lodash');
var fs = require('fs');
var path = require('path');

function FixturesSync() {
  var fixtureList = fs.readdirSync(path.join(__dirname, './')).filter(function (item) {
    return 'index.js' !== item;
  });
  var fixtures;

  if (!fixtures) {
    fixtures = {};
    _.forEach(fixtureList, function A(value) {
      fixtures[path.basename(value, '.js')] = require('./' + value);
    });
  }
  return fixtures;
}

var standardFixture = FixturesSync();

module.exports = function () {
  return _.cloneDeep(standardFixture);
};
