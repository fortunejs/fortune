var Adapter = {};


Adapter.read = function (name, id, query) {
  console.log([name, id, JSON.stringify(query)]);
  return new Promise(function (resolve) {
    return resolve([
      {foo: 'bar', friends: [1, 'a'], spouse: 'zz'},
      {zzz: 'xxx', friends: [1, 'k', 'y']}
    ]);
  });
};


module.exports = Adapter;
