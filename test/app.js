var fortune = require('../lib/fortune');
var RSVP = require('rsvp');

function createApp(options) {
    var fortuneApp = fortune(options)
            .resource('person', {
                name: String,
                appearances: Number,
                pets: ['pet'],
                soulmate: {ref: 'person', inverse: 'soulmate'},
                lovers: [{ref: 'person', inverse: 'lovers'}]
            })
            .resource('pet', {
                name: String,
                appearances: Number,
                owner: 'person'
            })
            .resource('foobar', {
                foo: String
            })
            .transform(
            function (req, res) {
                var foobar = this;
                return new RSVP.Promise(function(resolve, reject) {
                    if (foobar.foo && foobar.foo !== 'bar') {
                        var error = new Error();
                        error.problem = {
                            httpStatus: 400,
                            title: 'foobar error',
                            detail: 'Foo was not bar'
                        };
                        reject(error);
                    }
                    else {
                        resolve(foobar);
                    }
                });
            },
            function () {
            })
        ;

    return RSVP.all([
        fortuneApp.onRouteCreated('pet'),
        fortuneApp.onRouteCreated('person'),
        fortuneApp.onRouteCreated('foobar')
    ])
        .then(function () {
            fortuneApp.listen(process.env.PORT);
            return fortuneApp;
        });
}

module.exports = createApp;
