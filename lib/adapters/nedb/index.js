var Promise = require('promise');


var Adapter = {};


Adapter.find = function (name, id, query) {
  console.log([name, id, query]);
  return new Promise(function (resolve) {
    return resolve([{foo: 'bar', friends: [1, 'a'], spouse: 'zz'}, {zzz: 'xxx', friends: [1, 'k', 'y']}]);
  });
};


module.exports = Adapter;
