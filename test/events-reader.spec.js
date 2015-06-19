var RSVP = require('rsvp');
var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var request = require('supertest');
var Promise = RSVP.Promise;
var BSON = require('mongodb').BSONPure;

//require('longjohn');

var harvesterPort = 8003
var baseUrl = 'http://localhost:' + harvesterPort;
var reportAPI_baseUri = 'http://localhost:9988';

var nock = require('nock');

var chai = require('chai');

var chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.request.addPromises(RSVP.Promise);

var $http = require('http-as-promised');

$http.debug = true;
$http.request = require('request-debug')($http.request);

var debug = require('debug')('events-reader-test');

var expect = chai.expect;

var harvester = require('../lib/harvester');

var createReportPromise;
var createReportResponseDfd;

// todo checkpoints, todo check skipping

var harvesterOptions = {
    adapter: 'mongodb',
    connectionString: 'mongodb://127.0.0.1:27017/test',
    db: 'test',
    inflect: true,
    oplogConnectionString: 'mongodb://127.0.0.1:27017/local?slaveOk=true'
};

describe('onChange callback, event capture and at-least-once delivery semantics', function () {

    var harvesterApp;

    describe('Given a post on a very controversial topic, ' +
    'and a new comment is posted or updated with content which contains profanity, ' +
    'the comment is reported as abusive to another API. ', function () {

        before(function (done) {

            var that = this;
            that.timeout(100000);

            harvesterApp = harvester(harvesterOptions).resource('post', {
                        title: String
                    })
                    .onChange({
                        delete: function () {
                            console.log('deleted a post')
                        }
                    })
                    .resource('comment', {
                        body: String,
                        post: 'post'
                    })
                    .onChange({insert: reportAbusiveLanguage, update: reportAbusiveLanguage});

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

        beforeEach(function (done) {
            var that = this;
            that.timeout(100000);

            createReportResponseDfd = RSVP.defer();
            createReportPromise = createReportResponseDfd.promise;

            console.log('drop database');
            harvesterApp.adapter.db.db.dropDatabase();

            that.checkpointCreated = harvesterApp.eventsReader(harvesterOptions.oplogConnectionString).then(function (EventsReader) {

                    that.eventsReader = new EventsReader();

                    // sleep 1000 to prevent we are reprocessing oplog entries from the previous test
                    // precision for an oplog ts is 1s
                    require('sleep').sleep(1);
                    var now = BSON.Timestamp(0, (new Date() / 1000));

                    console.log('creating checkpoint with ts ' + now.getHighBits());
                    return harvesterApp.adapter.create('checkpoint', {ts: now}).then(function () {
                        return done();
                    });

                })
                .catch(function (err) {
                    done(err);
                });
        });

        afterEach(function () {
            this.eventsReader.stop()
                .then(function () {
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        describe('When a new post is added', function () {
            it('should skip as there is only a change handler fn defined on delete', function (done) {

                var that = this;
                that.timeout(100000);

                that.eventsReader.skip = function (dfd, doc) {
                    if (doc.ns === 'test.posts') {
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

                that.checkpointCreated.then(function () {
                    setTimeout(that.eventsReader.tail.bind(that.eventsReader), 500);
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


