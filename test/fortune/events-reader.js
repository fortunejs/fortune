var RSVP = require('rsvp');
var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var request = require('supertest');
var Promise = RSVP.Promise;
var BSON = require('mongodb').BSONPure;

//require('longjohn');

var baseUrl = 'http://localhost:' + process.env.PORT;
var telemetryBaseUri = 'http://localhost:9988';

var rp = require('request-promise');
var nock = require('nock');

var chai = require('chai');

var chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.request.addPromises(RSVP.Promise);

var expect = chai.expect;

var fortune = require('../../lib/fortune');

var createCanAlarmResponsePromise;
var createCanAlaramResponseDfd;

describe('onChange', function () {

    before(function (done) {

        var that = this;
        that.timeout(100000);

        var options = {
            adapter: 'mongodb',
            connectionString: process.argv[2] || process.env.MONGODB_URL || "‌mongodb://127.0.0.1:27017/test",
            db: 'test',
            inflect: true
        };

        that.fortuneApp = fortune(options)

            .resource('alarmDetail', {
                comparator: Number,
                valueThreshold: Number,
                timeThreshold: Number,
                createDate: Date,
                createdBy: String,
                alarmId: String,
                prevAlarmId: String
            })
            .onChange({insert: createTelemetryAlarm});

        function createTelemetryAlarm(id) {
            console.log('handler triggered : alarmDetail ' + id);
            return that.fortuneApp.adapter.find('alarmDetail', id.toString())
                .then(function (alarmDetail) {
                    rp.debug = true;
                    return rp(
                        {
                            resolveWithFullResponse: true,
                            uri: telemetryBaseUri + '/canAlarms',
                            method: 'POST',
                            json: {
                                canAlarms: [
                                    {
                                        id: alarmDetail.alarmId,
                                        comparator: alarmDetail.comparator,
                                        valueThreshold: alarmDetail.valueThreshold,
                                        timeThreshold: alarmDetail.timeThreshold
                                    }
                                ]
                            }
                        })
                        // then catch handlers below are added to be able to assert results
                        // this is not common for production code
                        .then(function (response) {
                            console.log('resolved');
                            createCanAlaramResponseDfd.resolve(response);
                        })
                });
        }

        that.fortuneApp
            .onRouteCreated('alarmDetail')
            .then(function () {
                // do once
                that.fortuneApp.listen(8001);
                done();
            })
            .catch(function (err) {
                done(err);
            });


    });

    function test(done, mockCanAlarms) {
        var that = this;
        that.timeout(100000);
        var chaiExpress = chai.request(that.fortuneApp.router);

        mockCanAlarms();

        chaiExpress.post('/alarmDetails')
            .send(
            {
                alarmDetails: [
                    {
                        comparator: 1,
                        valueThreshold: 100,
                        timeThreshold: 20,
                        createDate: new Date(),
                        createdBy: 'kristof'
                    }
                ]
            })
            .then(function (res) {
                expect(res).to.have.status(201);
                console.log(res.body);
                createCanAlarmResponsePromise
                    .then(function (createCanAlarmResponse) {
                        expect(createCanAlarmResponse).to.have.status(201);
                        done();
                    })
                    .catch(function (err) {
                        console.trace(err);
                        done(err)
                    });
            })
            .catch(function (err) {
                done(err);
            });
    }


    describe('Scenario: insert resources in 2 different APIs with eventual consistency', function () {
        describe('Given no pre-existing alarmDetails', function () {
            describe('When a new alarmDetail is posted to the alarmDetails resource, ' +
                'an onchange handler is defined which calls out to the canAlarms resource, ', function () {

                beforeEach(function(done) {
                    var that = this;
                    that.timeout(100000);


                    createCanAlaramResponseDfd = RSVP.defer();
                    createCanAlarmResponsePromise = createCanAlaramResponseDfd.promise;

                    console.log('drop database');
                    that.fortuneApp.adapter.db.db.dropDatabase();

                    return require('../../lib/events-reader')(that.fortuneApp, process.env.OPLOG_MONGODB_URL || process.argv[3])
                        .then(function (eventsReader) {
                            that.eventsReader = eventsReader;

                            function tailAndDone() {
                                that.eventsReader.tail()
                                    .then(function () {
                                        done();
                                    }); // no need to add a catch here, events-reader exits in case of an error
                            }

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

                afterEach(function() {
                    this.eventsReader.stop()
                        .then(function() {
                            done();
                        })
                        .catch(function (err) {
                            done(err);
                        });
                });


                    it('and that resource responds with a 201 created' +
                        'Then the onChange handler should complete successfully', function (done) {
                        test.call(this, done, function () {

                            nock(telemetryBaseUri, {allowUnmocked: true})
                                .post('/canAlarms')
                                .reply(201, function (uri, requestBody) {
                                    return requestBody;
                                });
                        });
                    });


                    it('and that resource responds with a 500 the first time, a 201 created the second time' +
                        'Then the onChange handler should complete successfully', function (done) {
                        test.call(this, done, function () {
                            nock(telemetryBaseUri, {allowUnmocked: true})
                                .post('/canAlarms')
                                .reply(500)
                                .post('/canAlarms')
                                .reply(201, function (uri, requestBody) {
                                    return requestBody;
                                });
                        });
                    });

            });

        });
    });


});


