var $http = require('http-as-promised');
var harvester = require('../lib/harvester');
var baseUrl = 'http://localhost:' + 8012;
var chai = require('chai');
var expect = chai.expect;
var ess = require('event-source-stream');
var _ = require('lodash');
var config = require('./config.js');
var seeder = require('./seeder.js');
var Joi = require('joi');
var Promise = require('bluebird');

describe('EventSource implementation for multiple resources', function () {

    var sendAndCheckSSE = function(resources, payloads, done) {
        var index = 0;
        ess(baseUrl + '/changes/stream?resources=' + resources.join(','), {retry : false})
        .on('data', function(data) {
            lastEventId = data.id;
            var data = JSON.parse(data.data);
            //ignore ticker data
            if(_.isNumber(data)) {

                //post data after we've hooked into change events and receive a ticker
                return Promise.map(payloads, function(payload) {
                    return seeder(harvesterApp, baseUrl).seedCustomFixture(payload).then(function() {
                        console.log('done')
                    })
                    .catch(function(err) {
                        console.log(err)
                    })
                });
                
            }

            console.log('---------->', data, index)
            console.log('---------->', payloads[index])
            expect(_.omit(data, 'id')).to.deep.equal(payloads[index][resources[index] + 's'][0]);
            if(index === payloads.length - 1) done();
            index++;
        });
    }

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

            harvesterApp = harvester(options)
                            .resource('booka', {
                                name: Joi.string()
                            })
                            .resource('bookb', {
                                name: Joi.string()
                            })
                            .resource('bookc', {
                                name: Joi.string()
                            })
                            .resource('bookd', {
                                name: Joi.string()
                            });
            harvesterApp.listen(8012);

            return seeder(harvesterApp, baseUrl).dropCollections('bookas')
        });

        describe('Given a list of resources A, B, C' + 
            '\nAND base URL base_url' + 
            '\nWhen a GET is made to base_url/changes/stream?resources=A ', function () {
            it('Then all events for resources A are streamed back to the API caller ', function (done) {
                var payloads = [{
                        bookas: [
                            {
                                name: 'test name 1'
                            }
                        ]
                    }];
                sendAndCheckSSE(['booka'], payloads, done);
            });
        });

        describe.only('Given a list of resources A, B, C' + 
            '\nAND base URL base_url' + 
            '\nWhen a GET is made to base_url/changes/stream?resources=A,B,C ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                var payloads = [{
                        bookas: [
                            {
                                name: 'test name 1'
                            }
                        ]
                    },
                    {
                        bookbs: [
                            {
                                name: 'test name 2'
                            }
                        ]
                    },
                    {
                        bookcs: [
                            {
                                name: 'test name 3'
                            }
                        ]
                    }];
                sendAndCheckSSE(['booka', 'bookb', 'bookc'], payloads, done);
            });
        });
    });
});
