var $http = require('http-as-promised');
var harvester = require('../lib/harvester');
var baseUrl = 'http://localhost:' + 8005;
var chai = require('chai');
var expect = chai.expect;
var ess = require('event-source-stream');
var _ = require('lodash');
var config = require('./config.js');
var seeder = require('./seeder.js');
var Joi = require('joi');

describe('EventSource implementation for resource changes', function () {

    var harvesterApp;
    describe('Server Sent Events', function () {
        this.timeout(10000);
        var lastEventId;
        var lastDataId;

        before(function () {
            var options = {
                adapter: 'mongodb',
                connectionString: config.harvester.options.connectionString,
                db: 'test',
                inflect: true,
                oplogConnectionString: config.harvester.options.oplogConnectionString
            };

            harvesterApp = harvester(options).resource('book', {
                title: Joi.string(),
                author: Joi.string()
            });

            harvesterApp.listen(8005);

            return seeder(harvesterApp, baseUrl).dropCollections('books')
        });

        describe('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {
                var that = this;
                var dataReceived;

                var eventSource = ess(baseUrl + '/books/changes/stream', {retry : false})
                .on('data', function(data) {

                    lastEventId = data.id;
                    var data = JSON.parse(data.data);
                    //ignore ticker data
                    if(_.isNumber(data)) {
                        //post data after we've hooked into change events and receive a ticker
                        return seeder(harvesterApp, baseUrl).seedCustomFixture({
                            books: [
                                {
                                    title: 'test title 2'
                                }
                            ]
                        });
                    }
                    if (dataReceived) return;
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 2'});
                    dataReceived = true;
                    done();
                    eventSource.destroy();
                });
            }
              );
        });

        describe('when I ask for events with ids greater than a certain id with filters enabled', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(harvesterApp, baseUrl).seedCustomFixture({
                    books: [
                        {
                            title: 'test title 3'
                        },
                        {
                            title: 'filtered'
                        },
                        {
                            title: 'filtered',
                            author: 'Asimov'
                        }
                    ]
                });
                var eventSource = ess(baseUrl + '/books/changes/stream?title=filtered&author=Asimov&limit=100', {retry : false, headers : {
                    'Last-Event-ID' : lastEventId
                }}).on('data', function(data) {
                    lastEventId = data.id;
                    var data = JSON.parse(data.data);
                    //ignore ticker data
                    if(_.isNumber(data)) return;
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'filtered', author : 'Asimov'});
                    dataReceived = true;
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('when I ask for events with ids greater than a certain id', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(harvesterApp, baseUrl).seedCustomFixture({
                    books: [
                        {
                            title: 'test title 3'
                        }
                    ]
                });
                var eventSource = ess(baseUrl + '/books/changes/stream', {retry : false, headers : {
                    'Last-Event-ID' : lastEventId
                }}).on('data', function(data) {
                    var data = JSON.parse(data.data);
                    //ignore ticker data
                    if(_.isNumber(data)) return;
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 3'});
                    dataReceived = true;
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('Given a resource x with property y ' +
                 '\nWhen the value of y changes', function () {
            it('Then an SSE is broadcast with event set to x_update, ID set to the oplog timestamp' +
                 'and data set to an instance of x that only contains the new value for property y', function (done) {
                var that = this;
                var counter = 0;

                var payloads = [
                    {
                        books: [{
                            title: 'test title 4',
                            author: 'Asimov'
                        }]
                    },
                    {
                        books: [{
                            title: 'test title 5'
                        }]
                    }
                ];

                var eventSource = ess(baseUrl + '/books/changes/stream', {retry : false})
                .on('data', function(data) {

                    lastEventId = data.id;
                    var data = JSON.parse(data.data);

                    //ignore ticker data
                    if(_.isNumber(data)) {
                        //post data after we've hooked into change events and receive a ticker
                        return $http.post(baseUrl + '/books', {json : payloads[0]})
                        .spread(function(res) {
                            return $http.put(baseUrl + '/books/' + res.body.books[0].id, {json : payloads[1]});
                        });
                    }

                    expect(_.omit(data, 'id')).to.deep.equal(payloads[counter].books[0]);
                    dataReceived = true;
                    counter ++;
                    if (counter === 1) {
                        done();
                        eventSource.destroy();
                    }
                });
            });
        });
    });
});
