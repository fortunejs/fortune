var Adapter = {};


Adapter.find = function (name, id, query) {
	return new Promise(function (resolve, reject) {
		return resolve([{foo: 'bar', friends: [1, 2, 3]}, {zzz: 'xxx'}]);
	});
};


module.exports = Adapter;
