var Mocha = require('mocha'),
    path = require('path'),
    fs = require('fs'),
    location = path.normalize(__dirname);

var mocha = new Mocha()
    .reporter('spec')
    .ui('bdd');

mocha.addFile(path.join(location, 'global.spec.js'));
mocha.addFile(path.join(location, 'all.js'));

mocha.run(function (failures) {
    process.exit(failures);
});

