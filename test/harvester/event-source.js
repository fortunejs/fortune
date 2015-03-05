var $http = require('http-as-promised');
var harvester = require('../../lib/harvester');
var baseUrl = 'http://localhost:' + 8001;
var chai = require('chai');
var expect = chai.expect;
var ess = require('event-source-stream');
var _ = require('lodash');
/*$http.debug = true;*/
//$http.request = require('request-debug')($http.request);

describe('onChange callback, event capture and at-least-once delivery semantics', function () {

    describe('Given a post on a very controversial topic, ' +
    'and a new comment is posted or updated with content which contains profanity, ' +
    'the comment is reported as abusive to another API. ', function () {

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
              var dataReceived; 
              ess(baseUrl + '/posts/changes')
              .on('data', function(data) {
                if (dataReceived) return;
                dataReceived = true;
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
        });
    });

    describe('When I post to the newly created resource', function () {
        it('Then I should receive a change event with data equal to what I posted', function (done) {
          var that = this;
          that.timeout(100000);
          var dataReceived; 
          ess(baseUrl + '/posts/changes')
          .on('data', function(data) {
            if (dataReceived) return;
            dataReceived = true;
            var data = JSON.parse(data);
            expect(_.omit(data, 'id')).to.deep.equal({title : 'test title'});
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
    });

});
