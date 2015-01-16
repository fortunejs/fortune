var RSVP = require('rsvp');
var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var request = require('supertest');
var Promise = RSVP.Promise;
var BSON = require('mongodb').BSONPure;

//require('longjohn');

var baseUrl = 'http://localhost:' + 8001;
var reportAPI_baseUri = 'http://localhost:9988';

var rp = require('request-promise');
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

var fortune = require('../../lib/fortune');

var createReportPromise;
var createReportResponseDfd;

// todo checkpoints, todo check skipping

describe('onChange callback, event capture and at-least-once delivery semantics', function () {

    before(function (done) {

        var that = this;
        that.timeout(100000);

        var options = {
            adapter: 'mongodb',
            connectionString: process.argv[2] || process.env.MONGODB_URL || "‌mongodb://127.0.0.1:27017/test",
            db: 'test',
            inflect: true
        };

        that.fortuneApp =
            fortune(options)
                .resource('post', {
                    title: String
                })
                .resource('comment', {
                    body: String,
                    post: 'post'
                })
                .onChange({insert: reportAbusiveLanguage, update: reportAbusiveLanguage});

        var profanity = require('profanity-util');

        function reportAbusiveLanguage(id) {
            return that.fortuneApp.adapter.find('comment', id.toString())
                .then(function (comment) {
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

        that.fortuneApp
            .onRouteCreated('comment')
            .then(function () {
                // do once
                that.fortuneApp.listen(8001);
                done();
            })
            .catch(function (err) {
                done(err);
            });


    });

    function test(done, mockBars) {
        var that = this;
        that.timeout(100000);
        var chaiExpress = chai.request(that.fortuneApp.router);

        mockBars();

        chaiExpress.post('/posts')
            .send({
                posts: [{
                    title: "a very controversial topic"
                }]
            })
            .then(function (postResponse) {
                expect(postResponse).to.have.status(201);
                return chaiExpress.post('/comments')
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


    describe('Given a post on a very controversial topic ', function () {
        describe('and a new comment is posted or updated with content which contains profanity, ' +
        'the comment is reported as abusive to another API. ' +
        ', ', function () {

            beforeEach(function (done) {
                var that = this;
                that.timeout(100000);


                createReportResponseDfd = RSVP.defer();
                createReportPromise = createReportResponseDfd.promise;

                console.log('drop database');
                that.fortuneApp.adapter.db.db.dropDatabase();

                return that.fortuneApp.eventsReader(process.env.OPLOG_MONGODB_URL || process.argv[3])
                    .then(function (eventsReader) {
                        that.eventsReader = eventsReader;

                        function tailAndDone() {
                            that.eventsReader.tail()
                                .then(function () {
                                    done();
                                }); // no need to add a catch here, events-reader exits in case of an error
                        }

                        // sleep 1000 to prevent we are reprocessing oplgo entries from the previous test
                        // precision for an oplog ts is 1s
                        require('sleep').sleep(1);
                        var now = BSON.Timestamp(0, (new Date() / 1000));

                        console.log('creating checkpoint with ts ' + now.getHighBits());
                        return that.fortuneApp.adapter.create('checkpoint', {ts: now})
                            .then(function () {
                                setTimeout(tailAndDone, 500);
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


            it('When that abuse report API resource responds with a 201 created' +
            'Then the event is considered as handled and should complete successfully with an updated checkpoint', function (done) {
                test.call(this, done, function () {

                    nock(reportAPI_baseUri, {allowUnmocked: true})
                        .post('/reports')
                        .reply(201, function (uri, requestBody) {
                            return requestBody;
                        });
                    //todo add verify checkpoint
                });
            });


            it('When that abuse report API resource responds the first time with a 500' +
            'Then the event is retried and should complete successfully if the abuse report API responds with a 201 this time', function (done) {
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

});


