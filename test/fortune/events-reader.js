var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var BSON = require('mongodb').BSONPure;

require('longjohn');

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


describe('onChange', function () {

    before(function (done) {

        var that = this;
        that.timeout(50000);

        var createCanAlaramResponseDfd = RSVP.defer();
        that.createCanAlarmResponsePromise = createCanAlaramResponseDfd.promise;

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
            return that.fortuneApp.adapter.find('alarmDetail', id.toString())
                .then(function (alarmDetail) {

                    rp.debug = true;
                    return rp(
                        {
                            resolveWithFullResponse: true,
                            uri: telemetryBaseUri + '/canAlarms',
                            method: 'POST',
                            json: {
                                "canAlarms": [
                                    {
                                        id: alarmDetail.alarmId,
                                        comparator: alarmDetail.comparator,
                                        valueThreshold: alarmDetail.valueThreshold,
                                        timeThreshold: alarmDetail.timeThreshold
                                    }
                                ]
                            }
                        })
                        // code below is added to be able to assert results
                        // production code
                        .then(function (response) {
                            console.log('bla');
                            createCanAlaramResponseDfd.resolve(response);
                        })
                        .catch(function (err) {
                            console.log('bla2');
                            createCanAlaramResponseDfd.reject(err);
                        });
                });
        }

        that.fortuneApp
            .onRouteCreated('alarmDetail')
            .then(function () {
                that.fortuneApp.listen(process.env.PORT);
                that.fortuneApp.adapter.db.db.dropDatabase();

                 return require('../../lib/events-reader')(that.fortuneApp, process.env.OPLOG_MONGODB_URL)
                    .then(function (eventsReader) {
                        that.eventsReader = eventsReader;

                        function tailAndDone() {
                            that.eventsReader.tail()
                                .then(function () {
                                    done();
                                }); // no need to add a catch here, events-reader exits in case of an error
                        }

                        return that.fortuneApp.adapter.create('checkpoint', {ts: BSON.Timestamp(0, (Date.now() / 1000) - 5)})
                            .then(function () {
                                setTimeout(tailAndDone, 500);
                            });

                    });
            })
            .catch(function (err) {
                done(err);
                // todo find a more elegant solution for this,
                // investigate how to easy wrap the promise chain with catch done handler
            });


    });

    describe('Scenario: insert a alarmDetail in EM API domain', function () {
        describe('Given no pre-existing alarmDetails', function () {
            describe('When a new alarmDetail is posted to the alarmDetails resource', function () {
                it('Then a new alarmDetail is created and a subsequent call is made to the telemetry API to create a canAlarm', function (done) {

                    var that = this;
                    that.timeout(50000);
                    var chaiExpress = chai.request(that.fortuneApp.router);

                    options = {allowUnmocked: true};
                    var scope = nock(telemetryBaseUri, options)
                        .post('/canAlarms')
                        .reply(201, function (uri, requestBody) {
                            return requestBody;
                        });

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
                            that.createCanAlarmResponsePromise
                                .then(function (createCanAlarmResponse) {
                                    expect(createCanAlarmResponse).to.have.status(201);
                                    done();
                                })
                                .catch(function (err) {
                                    done(err)
                                });
                        })
                        .catch(function (err) {
                            done(err);
                        });

                });
            });
        });
    });


});


