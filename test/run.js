var Mocha = require('mocha')
  , path = require("path")
  , location = path.normalize(__dirname);
 
var mocha = new Mocha()
  .reporter('spec')
  .ui('bdd')
  .addFile(path.join(location, 'all.js'))
  .run(function (failures) {
    process.exit(failures);
  });
