var $http = require('http-as-promised');
var harvester = require('../lib/harvester');
var baseUrl = 'http://localhost:' + 8005;
var chai = require('chai');
var expect = chai.expect;
var ess = require('agco-event-source-stream');
var _ = require('lodash');
var config = require('./config.js');
var seeder = require('./seeder.js');
var Joi = require('joi');
var Promise = require('bluebird');

describe('EventSource implementation for resource changes', function () {

    var harvesterApp;
    describe('Server Sent Events', function () {
        this.timeout(20000);
        var lastEventId;

        before(function () {
            var options = {
                adapter: 'mongodb',
                connectionString: config.harvester.options.connectionString,
                db: 'test',
                inflect: true,
                oplogConnectionString: config.harvester.options.oplogConnectionString
            };

            /**
             * dvd resource  should be declared after book, to test if it does not overwrite book sse config
             */
            harvesterApp = harvester(options).resource('book', {
                title: Joi.string(),
                author: Joi.string()
            }).resource('superHero', {
                timestamp: Joi.number()
            }).resource('dvd', {
                title: Joi.string()
            });

            harvesterApp.listen(8005);

            return seeder(harvesterApp, baseUrl).dropCollections('books', 'dvds', 'superHeros');
        });

        describe('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {
                var that = this;

                var eventSource = ess(baseUrl + '/books/changes/stream', {retry : false})
                .on('data', function(res) {

                    lastEventId = res.id;
                    var data = JSON.parse(res.data);
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
                    expect(res.event.trim()).to.equal('books_i');
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 2'});
                    done();
                    eventSource.destroy();
                });
            }
              );
        });

        describe('When I post resource with uppercased characters in name', function () {
            it('Then I should receive a change event', function (done) {
                    var eventSource = ess(baseUrl + '/superHeros/changes/stream', {retry: false})
                        .on('data', function (data) {
                            data = JSON.parse(data.data);
                            expect(_.omit(data, 'id')).to.deep.equal({timestamp: 123});
                            done();
                            eventSource.destroy();
                        });

                    Promise.delay(100).then(function () {
                        seeder(harvesterApp, baseUrl).seedCustomFixture({
                            superHeros: [
                                {
                                    timestamp: 123
                                }
                            ]
                        });
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
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('Given a resource x with property y ' +
                 '\nWhen the value of y changes', function () {
            it('Then an SSE is broadcast with event set to x_update, ID set to the oplog timestamp' +
                 'and data set to an instance of x that contains document id and new value for property y', function (done) {

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
                $http.post(baseUrl + '/books', {json: payloads[0]}).spread(function(res)
                {
                    var counter = 0;
                    var documentId = res.body.books[0].id;
                    var expected = {
                        _id: documentId,
                        title: payloads[1].books[0].title
                    };

                    var eventSource = ess(baseUrl + '/books/changes/stream', {retry: false})
                        .on('data', function (data)
                        {
                            var data = JSON.parse(data.data);
                            if (counter === 0) {
                                $http.put(baseUrl + '/books/' + documentId, {json: payloads[1]});
                            }
                            if (counter === 1) {
                                expect(data).to.deep.equal(expected);
                            }
                            if (counter === 2) {
                                done();
                                eventSource.destroy();
                            }
                            counter++;
                        });
                });
            });
        });


        describe('When I update collection document directly through mongodb adapter', function()
        {
            var documentId = '', model;

            before(function(done)
            {
                seeder(harvesterApp, baseUrl).seedCustomFixture({
                    books: [
                        {
                            title: 'The Bourne Identity',
                            author: 'Robert Ludlum'
                        }
                    ]
                }).then(function (result)
                {
                    documentId = result[0].books[0];
                    done();
                });
                model = harvesterApp.adapter.model('book');
            });

            it('Then SSE should broadcast event with data containing properties that has been changed', function(done)
            {
                var expected = {
                    _id: documentId,
                    title: 'The Bourne Supremacy'
                };
                var counter = 0;
                var eventSource = ess(baseUrl + '/books/changes/stream', {retry: false})
                    .on('data', function (data)
                    {
                        var data = JSON.parse(data.data);
                        if (0 === counter) {
                            harvesterApp.adapter.db.collections.books.findOneAndUpdate({'_id': documentId}, {'title': 'The Bourne Supremacy'});
                        }
                        if (1 === counter) {
                            expect(data).to.deep.equal(expected);
                        }
                        if (2 === counter) {
                            done();
                            eventSource.destroy();
                        }
                        counter++;
                    });
            });
        });
    });
});
