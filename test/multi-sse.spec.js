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

describe('EventSource implementation for multiple resources', function () {

    var harvesterApp;
    describe.only('Server Sent Events', function () {
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
            console.log('hello')
            harvesterApp.listen(8012);

            return seeder(harvesterApp, baseUrl).dropCollections('books')
        });

        describe.only('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {
                var that = this;
                var dataReceived;
                ess(baseUrl + '/changes/stream?resources=book', {retry : false})
                .on('data', function(data) {
                    console.log(data)

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
                        }).then(function() {
                            console.log('done')
                        })
                    }
                    if (dataReceived) return;
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 2'});
                    dataReceived = true;
                    done();
                });
            }
              );
        });
    });
});
