var Mocha = require('mocha'),
    path = require('path'),
    fs = require('fs'),
    location = path.normalize(__dirname);

var mocha = new Mocha()
    .reporter('spec')
    .ui('bdd');

mocha.addFile(path.join(location, 'harvester/all.js'));
mocha.addFile(path.join(location, 'harvester/events-reader.js'));
mocha.addFile(path.join(location, 'harvester/sse.js'));
mocha.run(function (failures) {
    process.exit(failures);
});

