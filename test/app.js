var fortune = require('../lib/fortune');
var jsonProblemError = require('../lib/json-problem-error');
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
            .before(
            function (req, res) {
                var foobar = this;
                if (foobar.foo && foobar.foo !== 'bar') {
                    throw jsonProblemError(400, 'Foo was not bar');
                }
                else {
                    return foobar;
                }
            })
        ;

    fortuneApp.router.get('/random-error', function(req, res, next) {
        next(new Error('this is an error'));
    });

    fortuneApp.router.get('/json-problem-error', function(req, res, next) {
        next(jsonProblemError(400, 'Bar was not foo'));
    });


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
