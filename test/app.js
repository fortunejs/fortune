var harvester = require('../lib/harvester');
var JSONAPI_Error = harvester.JSONAPI_Error;

var Promise = require('bluebird');
Promise.longStackTraces();

var Joi = require('joi');

var config = require('./config.js');

function configureApp(harvesterApp) {
    harvesterApp.resource('person', {
        name: Joi.string().required().description('name'),
        appearances: Joi.number().required().description('appearances'),
        links: {
            pets: ['pet'],
            soulmate: {ref: 'person', inverse: 'soulmate'},
            lovers: [
                {ref: 'person', inverse: 'lovers'}
            ]
        }
    })

    .resource('vehicle', {
        name: Joi.string(),
        links: {
            owners: [
                {ref: 'person'}
            ]
        }
    })

    .resource('pet', {
        name: Joi.string().required().description('name'),
        appearances: Joi.number().required().description('appearances'),
        links: {
            owner: 'person',
            food: 'foobar'
        },
        adopted: Joi.date()
    })

    .resource('collar', {
        links: {
            collarOwner: 'pet'
        }
    })

    .resource('cat', {
        name: Joi.string().required().description('name'),
        hasToy: Joi.boolean().required().description('hasToy'),
        numToys: Joi.number().required().description('numToys')
    }, {namespace: 'animals'})

    .resource('foobar', {
        foo: Joi.string().required().description('name')
    })

    .before(function (req, res) {
        var foobar = this;

        if (foobar.foo && foobar.foo === 'bar') {
            // promise
            return new Promise(function (resolve, reject) {
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
        } else {
            return foobar;
        }
    })

    .resource('readers', {
        name: Joi.string().description('name')
    })
    .readOnly()

    .resource('restrict', {
        name: Joi.string().description('name')
    })
    .restricted()

    .resource('immutable', {
        name: Joi.string().description('name')
    })
    .immutable()

    .resource('object', {
        foo: Joi.object().required().keys({
            bar: Joi.string(),
            tab: Joi.object().keys({
                bats: Joi.array()
            }),
            any: Joi.any()
        })
    });

    harvesterApp.router.get('/random-error', function (req, res, next) {
        next(new Error('this is an error'));
    });

    harvesterApp.router.get('/json-errors-error', function (req, res, next) {
        next(new JSONAPI_Error({status: 400, detail: 'Bar was not foo'}));
    });


    return harvesterApp;
}

/**
 * Creates instance of harvester app with default routes.
 *
 * This function can be safely passed to before or beforeEach as it will attempt install app and config into mocha's context
 *
 * beforeEach(require('./app.js'));
 *
 * @returns {*} promise resolving to harvester app instance
 */
module.exports = function () {
    var app = harvester(config.harvester.options);
    configureApp(app);
    app.listen(config.harvester.port);
    this.harvesterApp = app;
    this.config = config;
    return app;
};
