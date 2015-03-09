var $http = require('http-as-promised');
var harvester = require('../../lib/harvester');
var baseUrl = 'http://localhost:' + 8002;
var chai = require('chai');
var expect = chai.expect;
var ess = require('event-source-stream');
var _ = require('lodash');

describe('EventSource implementation for resource changes', function () {

    describe('Server Sent Events', function () {
      this.timeout(100000);
      var lastEventId;
      var lastDataId;
      
      before(function (done) {

        var that = this;

        var options = {
            adapter: 'mongodb',
            connectionString: process.argv[2] || process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/test",
            db: 'test',
            inflect: true
        };

        that.harvesterApp =
          harvester(options)
          .resource('book', {
              title: String
          });

        that.harvesterApp.listen(8002);
        that.harvesterApp.adapter.db.db.dropDatabase();
        done();
      });

    describe('When I post to the newly created resource', function () {
        it('Then I should receive a change event with data', function (done) {
          var that = this;
            var dataReceived;
          $http({uri: baseUrl + '/books', method: 'POST',json: {
              books: [
                  {
                      title : 'test title 1'
                  }
              ]
          }});
          ess(baseUrl + '/books/changes/stream', {retry : false})
          .on('data', function(data) {

            lastEventId = data.id;
            var data = JSON.parse(data.data);
            //ignore ticker data
            if(_.isNumber(data)) { 
              //post data after we've hooked into change events and receive a ticker
              return $http({uri: baseUrl + '/books', method: 'POST',json: {
                books: [
                    {
                        title : 'test title 2'
                    }
                ]
              }});
            }
            if (dataReceived) return;
            expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 2'});
            dataReceived = true;
            done();
          });
          
          }
       );
    });

    describe('when I ask for events with ids greater than a certain id', function () {
        it('I should get only one event without setting a limit', function (done) {
          var that = this;
          $http({uri: baseUrl + '/books', method: 'POST',json: {
              books: [
                  {
                      title : 'test title 3'
                  }
              ]
          }});
          ess(baseUrl + '/books/changes/stream', {retry : false, headers : {
              'Last-Event-ID' : lastEventId
          }}).on('data', function(data) {
            console.log('---------->', data)
            var data = JSON.parse(data.data);
            //ignore ticker data
            if(_.isNumber(data)) return;
            expect(_.omit(data, 'id')).to.deep.equal({title : 'test title 3'});
            dataReceived = true;
            done();
          });
        });
    });

    /*describe('When I request certain types of events only', function () {*/
        //it('Then I should receive that sort of event only', function (done) {
          //var that = this;
          //that.timeout(100000);
          //$http({uri: baseUrl + '/books/' + lastDataId, method: 'DELETE'});
          //var dataReceived; 
          //ess(baseUrl + '/books/changes/stream?event=d', {retry : false})
          //.on('data', function(data) {
            //if (dataReceived) return;
            //dataReceived = true;
            //var data = JSON.parse(data.data);
            //expect(_.omit(data, 'id')).to.deep.equal({});
            //done();
          //});
          //$http({uri: baseUrl + '/books/' + lastDataId, method: 'DELETE'});
        //});
    /*});*/
});
});
