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
        });

    return RSVP.all([fortuneApp.onRouteCreated('pet'), fortuneApp.onRouteCreated('person')])
        .then(function () {
            fortuneApp.listen(process.env.PORT);
            return fortuneApp;
        });
}

module.exports = createApp;
