var harvest = require('../../lib/harvest');
var JSONAPI_Error = harvest.JSONAPI_Error;
var RSVP = require('rsvp');

function createApp(options) {

    var harvestApp = harvest(options)

        .resource('person', {
            name: String,
            appearances: Number,
            pets: ['pet'],
            soulmate: {ref: 'person', inverse: 'soulmate'},
            lovers: [
                {ref: 'person', inverse: 'lovers'}
            ]
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
                    reject(new JSONAPI_Error({
                        status: 400,
                        detail: 'Foo was bar'
                    }));
                });
            } else if (foobar.foo && foobar.foo === 'baz') {
                // non-promise
                throw new JSONAPI_Error({
                    status: 400,
                    detail: 'Foo was baz'
                });
            }
            else {
                return foobar;
            }
        }
    );


    harvestApp.router.get('/random-error', function (req, res, next) {
        next(new Error('this is an error'));
    });

    harvestApp.router.get('/json-errors-error', function (req, res, next) {
        next(new JSONAPI_Error({status: 400, detail: 'Bar was not foo'}));
    });


    return RSVP.all([
            harvestApp.onRouteCreated('pet'),
            harvestApp.onRouteCreated('person'),
            harvestApp.onRouteCreated('foobar')
        ])
        .then(function () {
            return harvestApp;
        });
}

module.exports = createApp;
