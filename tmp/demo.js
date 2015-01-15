import Fortune from '../';

var App = new Fortune({

});

App.resource('user', {
	name: String,
	age: {type: Number, min: 0, max: 100}
});

App.init().then(() => {
	App.listen(1337);
});
