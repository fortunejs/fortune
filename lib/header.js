'use strict'

var pkg = require('../package.json')

process.stdout.write([
  '/*!',
  ' * Fortune.js',
  ' * Version ' + pkg.version,
  ' * ' + pkg.license + ' License',
  ' * ' + pkg.homepage,
  ' */', ''
].join('\n'))
