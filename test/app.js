var fortune = require('../lib/fortune');
var JSONProblemError = require('../lib/jsonapi-error');
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

                if (foobar.foo && foobar.foo === 'bar') {
                    // promise
                    return new RSVP.Promise(function (resolve, reject) {
                        reject(new JSONProblemError({
                            status: 400,
                            detail: 'Foo was bar'
                        }));
                    });
                } else if (foobar.foo && foobar.foo === 'baz') {
                    // non-promise
                    throw new JSONProblemError({
                        status: 400,
                        detail: 'Foo was baz'
                    });
                }
                else {
                    return foobar;
                }
            }
        )
        .resource('bla', {
            name: String
        })
        .onChange(function(doc) {
            console.log('received doc '+ JSON.stringify(doc));
        });


    fortuneApp.router.get('/random-error', function (req, res, next) {
        next(new Error('this is an error'));
    });

    fortuneApp.router.get('/json-errors-error', function (req, res, next) {
        next(new JSONProblemError({status: 400, detail: 'Bar was not foo'}));
    });


    return RSVP.all([
        fortuneApp.onRouteCreated('pet'),
        fortuneApp.onRouteCreated('person'),
        fortuneApp.onRouteCreated('foobar'),
        fortuneApp.onRouteCreated('bla')
    ])
        .then(function () {
            return fortuneApp;
        });
}

module.exports = createApp;
