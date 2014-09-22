var Adapter = {};


Adapter.find = function (name, id, query) {
	return new Promise(function (resolve, reject) {
		return resolve([{foo: 'bar'}, {zzz: 'xxx'}]);
	});
};


module.exports = Adapter;
