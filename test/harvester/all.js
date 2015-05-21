var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');

var Promise = RSVP.Promise;
var fixtures = require('./fixtures.json');

var baseUrl = 'http://localhost:' + 8000;
var keys = {};

_.each(fixtures, function (resources, collection) {
    keys[collection] = inflect.pluralize(collection);
});

var options = {
    adapter: 'mongodb',
    connectionString: process.argv[2] || process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/testDB",
    db: 'testDB',
    inflect: true,
    oplogConnectionString : (process.env.OPLOG_MONGODB_URL || process.argv[3] || "mongodb://127.0.0.1:27017/local") + '?slaveOk=true'
};


describe('using mongodb adapter', function () {
    var ids = {};
    this.timeout(50000);


    before(function (done) {

        this.app = require('./app')(options)
        this.app.listen(8000);
        var expectedDbName = this.app.options.db;
        var harvesterApp = this.app;
        return new Promise(function (resolve) {
            harvesterApp.adapter.awaitConnection().then(function() {
                harvesterApp.adapter.db.db.dropDatabase();
                return resolve();
            })
         })
        .then(function () {
            console.log("--------------------");
            console.log("Running tests:");


            var createResources = [];

            _.each(fixtures, function (resources, collection) {
                var key = keys[collection];

                createResources.push(new Promise(function (resolve) {
                    var body = {};
                    body[key] = resources;
                    request(baseUrl)
                        .post('/' + key)
                        .send(body)
                        .expect('Content-Type', /json/)
                        .expect(201)
                        .end(function (error, response) {
                            should.not.exist(error);
                            var resources = JSON.parse(response.text)[key];
                            ids[key] = ids[key] || [];
                            resources.forEach(function (resource) {
                                ids[key].push(resource.id);
                            });
                            resolve();
                        });
                }));
            });

            return RSVP.all(createResources).then(function () {
                done();
            });
        })
        .catch(function (err) {
            done(err);
        });
    });


    require("./resources")(baseUrl,keys,ids);
    require("./associations")(baseUrl,keys,ids);
    require("./filters")(baseUrl,keys,ids);
    require("./paging")(baseUrl,keys,ids);
    require("./sorting")(baseUrl,keys,ids);
    require("./limits")(baseUrl,keys,ids);
    require("./includes")(baseUrl,keys,ids);
    require("./jsonapi_error")(baseUrl,keys,ids);
    require("./deletes")(baseUrl,keys,ids);


    after(function (done) {
        var that = this;
        _.each(fixtures, function (resources, collection) {
            var key = keys[collection];

            RSVP.all(ids[key].map(function (id) {
                    return new Promise(function (resolve) {
                        request(baseUrl)
                            .del('/' + key + '/' + id)
                            .expect(204)
                            .end(function (error) {
                                should.not.exist(error);
                                resolve();
                            });
                    });
                })).then(function () {
                    return that.app.then(function (harvesterApp) {
                        harvesterApp.router.close();
                        that.app = null;
                    });
                })
                .finally(function () {
                    done();
                });
        });
    });

});
