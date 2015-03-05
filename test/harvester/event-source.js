var $http = require('http-as-promised');
var harvester = require('../../lib/harvester');
var baseUrl = 'http://localhost:' + 8001;
var chai = require('chai');
var expect = chai.expect;

/*$http.debug = true;*/
//$http.request = require('request-debug')($http.request);

describe('onChange callback, event capture and at-least-once delivery semantics', function () {

    describe('Given a post on a very controversial topic, ' +
    'and a new comment is posted or updated with content which contains profanity, ' +
    'the comment is reported as abusive to another API. ', function () {

      console.log('testing')
        before(function (done) {

            var that = this;
            that.timeout(100000);

            var options = {
                adapter: 'mongodb',
                connectionString: process.argv[2] || process.env.MONGODB_URL || "‌mongodb://127.0.0.1:27017/test",
                db: 'test',
                inflect: true
            };

            that.harvesterApp =
              harvester(options)
              .resource('post', {
                  title: String
              });

            that.harvesterApp.listen(8001);
            done();
        });


        describe('When I create a new resource', function () {
            it('Then a "change" route should be added to that resource', function (done) {
              var that = this;
              that.timeout(100000);
              var ess = require('event-source-stream');
              var dataReceived; 
              ess(baseUrl + '/posts/changes')
              .on('data', function(data) {
                if (dataReceived) return;
                dataReceived = true;
                console.log('received event:', data)
                expect(data).to.exist;
                done();
              });

              return $http({uri: baseUrl + '/posts', method: 'POST',json: {
                          posts: [
                              {
                                  title : 'test title'
                              }
                          ]
                      }});
            });
        })
    });
});
