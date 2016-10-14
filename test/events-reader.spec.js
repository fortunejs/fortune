var _ = require('lodash');
var Promise = require('bluebird');
var BSON = require('mongodb').BSONPure;
var mongojs = require('mongojs');
var sinon = require('sinon');

//require('longjohn');

var harvesterPort = 8007;
var reportAPI_baseUri = 'http://localhost:9988';

var nock = require('nock');
var config = require('./config.js');

var chai = require('chai');

var chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.request.addPromises(Promise);

var $http = require('http-as-promised');

$http.debug = true;
$http.request = require('request-debug')($http.request);

var debug = require('debug')('events-reader-test');

var expect = chai.expect;

var harvester = require('../lib/harvester');

var Joi = require('joi');

var createReportPromise;
var createReportResponseDfd;

// todo checkpoints, todo check skipping

describe('onChange callback, event capture and at-least-once delivery semantics', function () {

    var harvesterApp;
    var petOnInsertHandler;

    describe('Given a post on a very controversial topic, ' +
        'and a new comment is posted or updated with content which contains profanity, ' +
        'the comment is reported as abusive to another API. ', function () {

        before(function (done) {

            petOnInsertHandler = sinon.stub().returnsArg(0);

            var that = this;
            that.timeout(100000);

            harvesterApp = harvester(config.harvester.options)
                .resource('post', {
                    title: Joi.string()
                })
                .onChange({
                    delete: function () {
                        console.log('deleted a post')
                    }
                })
                .resource('comment', {
                    body: Joi.string(),
                    links: {
                        post: 'post'
                    }
                })
                .onChange({insert: {func: reportAbusiveLanguage}, update: reportAbusiveLanguage})
                .resource('petshop', {
                    name: Joi.string()
                })
                .resource('pet', {
                    body: Joi.string()
                })
                .onChange({
                    insert: petOnInsertHandler
                })
                .resource('frog', {
                    body: Joi.string()
                })
                .onChange({
                    insert: petOnInsertHandler, asyncInMemory: true
                });

            that.chaiExpress = chai.request(harvesterApp.router);

            var profanity = require('profanity-util');

            function reportAbusiveLanguage(id) {
                return harvesterApp.adapter.find('comment', id.toString()).then(function (comment) {
                    var check = profanity.check(comment);
                    if (!!check && check.length > 0) {
                        return $http(
                            {
                                uri: reportAPI_baseUri + '/reports',
                                method: 'POST',
                                json: {
                                    reports: [
                                        {
                                            content: comment.body
                                        }
                                    ]
                                }
                            })
                            // then catch handlers below are added to be able to assert results
                            // this is not common for production code
                            .spread(function (response, reports) {
                                createReportResponseDfd.resolve(response);
                            })
                    } else {
                        return false;
                    }
                });
            }

            harvesterApp.listen(harvesterPort);
            done();
        });

        beforeEach(function () {
            var that = this;
            that.timeout(100000);

            createReportResponseDfd = Promise.defer();
            createReportPromise = createReportResponseDfd.promise;

            var oplogMongodbUri = config.harvester.options.oplogConnectionString;
            var oplogDb = mongojs(oplogMongodbUri);

            that.checkpointCreated = harvesterApp.eventsReader(oplogMongodbUri)
                .then(function (EventsReader) {
                    that.eventsReader = new EventsReader();
                })
                .then(function () {
                    return removeModelsData(harvesterApp, ['checkpoint', 'post', 'comment', 'pet', 'petshop', 'frog']);
                })
                .then(function () {
                    return initFromLastCheckpoint(harvesterApp, oplogDb);
                });

            // todo check this with Stephen
            // seeder dropCollections doesn't seem to actually remove the data from checkpoints
            // fabricated this function as a quick fix
            function removeModelsData(harvesterApp, models) {

                function removeModelData(model) {
                    return new Promise(function (resolve, reject) {
                        harvesterApp.adapter.model(model).collection.remove(function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
                }

                return Promise.all(_.map(models, removeModelData));
            }


            var initFromLastCheckpoint = function (harvesterApp, oplogDb) {

                var query = {}
                    , coll = oplogDb.collection('oplog.rs');

                return new Promise(function (resolve, reject) {
                    return coll.find(query).sort({ts: -1}).limit(1, function (err, docs) {
                        if (err) reject(err);
                        else resolve(docs);
                    });
                }).then(function (results) {
                        var lastTs;
                        if (results[0]) {
                            console.log('previous checkpoint found');
                            lastTs = results[0].ts;
                        } else {
                            console.log('no previous checkpoint found');
                            lastTs = BSON.Timestamp(0, 1);
                        }

                        // todo make available as a seperate function
                        function logTs(ts) {
                            console.log('creating checkpoint with ts ' + ts.getHighBits() + ' ' + ts.getLowBits() + ' ' +
                                new Date((ts.getHighBits()) * 1000));
                        }

                        logTs(lastTs);

                        return harvesterApp.adapter.create('checkpoint', {ts: lastTs});

                    });
            };

            return that.checkpointCreated;

        });

        afterEach(function (done) {
            var that = this;
            Promise.delay(1000).then(function () {
                that.eventsReader.stop()
                    .then(function () {
                        done();
                    })
                    .catch(done);
            });
        });

        describe('When a new post is added', function () {
            it('should skip as there is only a change handler fn defined on delete', function (done) {

                var that = this;
                that.timeout(100000);

                that.eventsReader.skip = function (dfd, doc) {
                    // todo fix this

                    var regex = new RegExp('.*\\.posts', 'i');
                    if (regex.test(doc.ns)) {
                        dfd.resolve();
                        done();
                    }
                };

                that.chaiExpress.post('/posts')
                    .send({
                        posts: [{
                            title: "a simple topic"
                        }]
                    })
                    .catch(function (err) {
                        console.trace(err);
                        done(err);
                    });

                that.checkpointCreated.then(function (checkpoint) {
                    that.eventsReader.tail();
                });

            });
        });

        describe('When that abuse report API resource responds with a 201 created', function () {
            it('Then the event is considered as handled and should complete successfully with an updated checkpoint', function (done) {
                test.call(this, done, function () {

                    nock(reportAPI_baseUri, {allowUnmocked: true})
                        .post('/reports')
                        .reply(201, function (uri, requestBody) {
                            return requestBody;
                        });
                    //todo add verify checkpoint
                });
            });
        });

        describe('When that abuse report API resource responds the first time with a 500', function () {
            it('Then the event is retried and should complete successfully if the abuse report API responds with a 201 this time', function (done) {
                test.call(this, done, function () {
                    nock(reportAPI_baseUri, {allowUnmocked: true})
                        .post('/reports')
                        .reply(500)
                        .post('/reports')
                        .reply(201, function (uri, requestBody) {
                            return requestBody;
                        });
                    //todo add verify checkpoint
                });
            });
        });

        describe('When pet is inserted', function () {
            it('should trigger pet onInsert handler', function (done) {
                var that = this;
                this.checkpointCreated.then(function () {
                    setTimeout(that.eventsReader.tail.bind(that.eventsReader), 500);
                });
                petOnInsertHandler.reset();
                this.chaiExpress.post('/pets')
                    .send({
                        pets: [{
                            body: 'Dogbert'
                        }]
                    }).then(function (res) {
                    expect(res).to.have.status(201);
                    return Promise.delay(1000).then(function () {
                        sinon.assert.calledOnce(petOnInsertHandler);
                        done();
                    });
                }).catch(done);
            });
        });

        describe('When petshop is inserted', function () {
            it('should NOT trigger pet onInsert handler', function (done) {
                var that = this;
                this.checkpointCreated.then(function () {
                    setTimeout(that.eventsReader.tail.bind(that.eventsReader), 500);
                });
                petOnInsertHandler.reset();
                this.chaiExpress.post('/petshops')
                    .send({
                        petshops: [{
                            name: 'Petoroso'
                        }]
                    })
                    .then(function (res) {
                        expect(res).to.have.status(201);
                        return Promise.delay(1000).then(function () {
                            sinon.assert.notCalled(petOnInsertHandler);
                            done();
                        });
                    })
                    .catch(done);
            });
        });

        // not a very meaningful test but will have to do for now
        describe('When a post is added 10000 times', function () {
            it('should process very fast', function (done) {
                var that = this;
                that.timeout(100000);

                that.checkpointCreated.then(function () {
                    setTimeout(that.eventsReader.tail.bind(that.eventsReader), 500);
                });

                var range = _.range(10000);
                var postPromises = Promise.resolve(range)
                    .map(function (i) {
                        return that.chaiExpress.post('/frogs')
                            .send({
                                frogs: [{
                                    body: i + " test"
                                }]
                            })
                    }, {concurrency: 20});

                Promise.all(postPromises)
                    .then(function () {
                        console.log('all posted');
                        setTimeout(done, 3000)
                    })
                    .catch(function (err) {
                        console.trace(err);
                        done(err);
                    });

            });
        });

    });

    function test(done, mockReports) {
        var that = this;
        that.timeout(100000);

        mockReports();

        that.checkpointCreated.then(function () {
            setTimeout(that.eventsReader.tail.bind(that.eventsReader), 500);
        });

        that.chaiExpress.post('/posts')
            .send({
                posts: [{
                    title: "a very controversial topic"
                }]
            })
            .then(function (postResponse) {
                expect(postResponse).to.have.status(201);
                return that.chaiExpress.post('/comments')
                    .send(
                    {
                        comments: [
                            {
                                body: 'shit ! what are you talking about !?',
                                links: {
                                    post: postResponse.body.id
                                }
                            }
                        ]
                    })
                    .then(function (commentResponse) {
                        expect(commentResponse).to.have.status(201);
                        debug(commentResponse.body);
                        return createReportPromise
                            .then(function (createReportResponse) {
                                expect(createReportResponse).to.have.status(201);
                                done();
                            })
                    })
            })
            .catch(function (err) {
                console.trace(err);
                done(err);
            });
    }
});


