var should = require("should");
var sinon = require("sinon");
var _ = require("lodash");
var request = require("supertest");
var fortune = require("../../lib/fortune");

var port = 8895;
var port2 = 8896;
var baseUrl = 'http://localhost:' + port;

module.exports = function(options){

  describe("custom instrumentor", function(){
    var mockInstrumentor, app, tracerStub;

    before( function(){
      mockInstrumentor = {
        instrumentor: {
          createTracer: sinon.stub().returnsArg( 1 )
        },
        options: {
          tracePrefix: 'Custom trace prefix: '
        }
      };
      tracerStub = mockInstrumentor.instrumentor.createTracer;

      app = fortune({
        adapter: "mongodb",
        port: port,
        connectionString : 'mongodb://localhost/instrumentor-test',
        serviceName: "user-service",
        customInstrumentorObj: mockInstrumentor
      })
      .resource("user", {
        userType : String,
        title : String,
        firstName : String,
      })
      .listen( port )

    });

    it('should be called', function(done){

      request( baseUrl ).get( '/users' )
        .expect(200)
        .end(function(err, res){
          tracerStub.should.be.called
        });
      done()
    });

    it('traces should be named suitably', function(done){
      request( baseUrl ).get( '/users' )
        .expect(200)
        .end(function(err, res){
          _.each( tracerStub.args, function( arg ){
            arg[0].should.be.type('string')
              .and.startWith( mockInstrumentor.options.tracePrefix );

            arg[1].should.be.type('function');
          });
        })
      done()
    });

    it('should cause error when not valid', function(done){

      var invalidInstrumentor = {
        methods: {
          createTransaction: sinon.stub().returnsArg( 1 ),
        }
      };
      var invalidInstrumentorApp = function(){
        var app2 = fortune({
          adapter: "mongodb",
          port: port,
          connectionString : 'mongodb://localhost/instrumentor-test2',
          serviceName: "user-service2",
          customInstrumentorObj: invalidInstrumentor
        })
        .resource("user", {
          userType : String,
          title : String,
          firstName : String,
        })
        .listen( port2 )
      };

      invalidInstrumentorApp.should.throwError('Invalid instrumentor');
      done()
    });
  });
};
