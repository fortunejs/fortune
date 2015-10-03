var request = require('supertest');
var harvester = require('../lib/harvester');
var baseUrl = 'http://localhost:' + 8020;
var chai = require('chai');
var expect = chai.expect;
var ess = require('event-source-stream');
var _ = require('lodash');
var config = require('./config.js');
var seeder = require('./seeder.js');
var Joi = require('joi');
var Promise = require('bluebird');

describe('EventSource implementation for multiple resources', function () {

    var harvesterApp;
    describe('Server Sent Events', function () {
        this.timeout(20000);
        var lastEventId;
        var lastDataId;

        var sendAndCheckSSE = function(resources, payloads, done) {
            var index = 0;
            ess(baseUrl + '/changes/stream?resources=' + resources.join(','), {retry : false})
            .on('data', function(data, id) {
                lastEventId = data.id;
                var data = JSON.parse(data.data);
                //ignore ticker data
                if(_.isNumber(data)) {

                    //post data after we've hooked into change events and receive a ticker
                    return Promise.map(payloads, function(payload) {
                        return seeder(harvesterApp, baseUrl).seedCustomFixture(payload)
                        .delay(500)
                        .then(function(res) {
                            console.log('done', res)
                        })
                        .catch(function(err) {
                            console.log(err)
                        })
                    }, {concurrency : 1});
                    
                }

                console.log(data, index, resources);

                expect(_.omit(data, 'id')).to.deep.equal(payloads[index][resources[index] + 's'][0]);
                if(index === payloads.length - 1) done();
                index++;
            });
        }

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
            harvesterApp.listen(8020);

            return seeder(harvesterApp, baseUrl).dropCollections('bookas')
        });

        describe('Given a list of resources A, B, C' + 
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
                    }];
                sendAndCheckSSE(['booka', 'bookb'], payloads, done);
            });
        });

        describe.only('Given a list of resources A, B, C' + 
            '\nAND base URL base_url' + 
            '\nWhen a GET is made to base_url/changes/stream?resources=A,D ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                request(baseUrl)
                    .get('/changes/stream?resources=booka,wrongResource')
                    .expect(400)
                    .expect(function(res) {
                        var error = JSON.parse(res.text);
                        console.log(error.errors[0].detail)
                        expect(error.errors[0].detail).to.equal('The follow resources don\'t exist wrongResource')
                    })
                    .end(done);
            });
        });
    });
});
