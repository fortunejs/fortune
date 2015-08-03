var should = require('should');
var _ = require('lodash');
var request = require('supertest');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;
var io = require('socket.io-client');

module.exports = function(options){
  describe('opinionated plugins', function(){
    var app, baseUrl, ids;
    beforeEach(function(){
      app = options.app;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });
    describe('last-modified plugin', function(){
      it('should extend resource schema', function(){
        _.each(app._resources, function(resource){
          _.has(resource.schema, 'modifiedAt').should.equal(true);
          _.has(resource.schema, 'createdAt').should.equal(true);
        });
      });
      it('should set created and modified property on each insert', function(done){
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            should.exist(body.people[0].modifiedAt);
            should.exist(body.people[0].createdAt);
            body.people[0].modifiedAt.should.equal(body.people[0].createdAt);
            done();
          });
      });
      it('should not modify createdAt on updates', function(done){
        new Promise(function(resolve){
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people:[{email: 'test@test.com'}]
            }))
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              resolve(body.people[0].createdAt, body.people[0].modifiedAt);
            });
        }).then(function(createdDate, modifiedDate){
          request(baseUrl).patch('/people/test@test.com')
            .set('content-type', 'application/json')
            .send(JSON.stringify([
              {op: "replace", path: "/people/0/name", value: "tested"}
            ]))
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              body.people[0].modifiedAt.should.not.equal(modifiedDate);
              body.people[0].createdAt.should.equal(createdDate);
              done();
            });
          });
      });
      it('should properly handle PUT requests', function(done){
        new Promise(function(resolve){
          request(baseUrl).put('/people/test@test.com')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com',
                name: 'test'
              }]
            }))
            .end(function(err, res){
              should.not.exist(err);
              var body = JSON.parse(res.text);
              var createdAt = body.people[0].createdAt;
              should.exist(createdAt);
              body.people[0].name.should.equal('test');
              resolve(createdAt);
            });
        }).then(function(createdAt){
            request(baseUrl).put('/people/test@test.com')
              .set('content-type', 'application/json')
              .send(JSON.stringify({
                people:[{
                  email: 'test@test.com',
                  name: 'changed'
                }]
              }))
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                body.people[0].createdAt.should.equal(createdAt);
                body.people[0].name.should.equal('changed');
                done();
              });
          });
      });
      it('should not overwrite explicitly set creation time', function(done){
        var check = new Date(new Date().getTime() - 1000);
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{email: 'test@test.com', createdAt: check}]
          }))
          .end(function(err, res){
            should.not.exist(err);
            var body = JSON.parse(res.text);
            new Date(body.people[0].createdAt).getTime().should.equal(new Date(check).getTime());
            done();
          });
      });
    });
    describe('websockets plugin', function(){
      var socket;
      before(function(done) {
        // console.log("websockets plugin before");
        socket = io.connect("http://localhost:" + options.ioPort + "/people");
        socket.on('connect', function(err) {
          done();
        });
      });

      beforeEach(function(done) {
        // console.log("websockets plugin beforeEach resetting connections");
        socket.off('add');
        socket.off('update');
        socket.off('delete');
        done();
      });

      afterEach(function(done) {
        // console.log("websockets plugin afterEach resetting connections");
        socket.off('add');
        socket.off('update');
        socket.off('delete');
        done();
      });

      xit('should inform users when a resource is added @now', function(done) {
        socket.on('add', function(data) {
          console.log("socket add", data);
          data.people.should.be.an.Array;
          data.people.length.should.equal(1);
          done();
        });
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
          });
      });
      it('should inform users when a resource is edited with put', function(done) {
        socket.on('update', function(data) {
          data.people.should.be.an.Array;
          data.people.length.should.equal(1);
          data.people[0].name.should.equal.changed;
          done();
        });
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
            request(baseUrl).put('/people/test@test.com')
              .set('content-type', 'application/json')
              .send(JSON.stringify({
                people:[{
                  email: 'test@test.com',
                  name: 'changed'
                }]
              }))
              .end(function(err, res){
              });
          });
      });
      it('should inform users when a resource is edited with patch', function(done) {
        socket.on('update', function(data) {
          data.people.should.be.an.Array;
          data.people.length.should.equal(1);
          data.people[0].name.should.equal.tested;
          done();
        });
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
            request(baseUrl).patch('/people/test@test.com')
              .set('content-type', 'application/json')
              .send(JSON.stringify([
                {op: "replace", path: "/people/0/name", value: "tested"}
              ]))
              .end(function(err, res){
                console.log('update complete');
              });
          });
      });
      it('should inform users when a resource is deleted', function(done) {
        socket.on('delete', function(data) {
          data.people.should.be.an.Array;
          data.people.length.should.equal(1);
          data.people[0].id.should.equal('test@test.com');
          done();
        });
        request(baseUrl).post('/people')
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{
              email: 'test@test.com'
            }]
          }))
          .end(function(err, res){
            request(baseUrl).del('/people/test@test.com')
              .end(function(err, res) {
            });
          });
      });

      it('should properly serialize the data', function(done){
        socket.on('update', function(data){
          data.people[0].links.should.be.an.Object;
          data.people[0].links.pets[0].should.equal(ids.pets[0]);
          should.not.exist(data.people[0].pets);
          done();
        });
        request(baseUrl).patch('/people/' + ids.people[0])
          .set('content-type', 'application/json')
          .send(JSON.stringify([
            {op: 'replace', path: '/people/0/pets', value: [ids.pets[0]]}
          ]))
          .end(function(err, res){
            should.not.exist(err);
          });
      });
    });
    describe('filtering integration', function(){
      var socket, createSocket;
      beforeEach(function(done) {
        socket = null;
        createSocket = function(query, callback){
          socket = io.connect("http://localhost:" + options.ioPort + "/people", {query: query, forceNew: true});
          socket.on('connect', function() {
            callback();
          });
          socket.on('error', function(err){
            callback(err);
          });
        };
        done();
      });

      afterEach(function(done) {
        socket.off('add');
        socket.off('update');
        socket.off('delete');
        done();
      });

      it('should apply simple query filter', function(done){
        var q = 'filter[email]=test@test.com';
        createSocket(q, function(err){
          should.not.exist(err);
          var callCount = 0;
          var callEmails = [];
          socket.on('add', function(data){
            callEmails.push(data.people[0].email);
            callCount++;
          });
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com'
              },{
                email: 'dummy@test.com'
              }]
            }))
            .end(function(err, res){
              should.not.exist(err);
              setTimeout(function(){
                callCount.should.equal(1);
                callEmails.should.eql(['test@test.com']);
                done();
              }, 100);
            });
        });
      });
      it('should apply $in filter', function(done){
        var q = 'filter[email][in]=test@test.com';
        createSocket(q, function(err){
          should.not.exist(err);
          var callCount = 0;
          var callEmails = [];
          socket.on('add', function(data){
            callEmails.push(data.people[0].email);
            callCount++;
          });
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com'
              },{
                email: 'dummy@test.com'
              }]
            }))
            .end(function(err, res){
              should.not.exist(err);
              setTimeout(function(){
                callCount.should.equal(1);
                callEmails.should.eql(['test@test.com']);
                done();
              }, 100);
            });
        });
      });
      it('should be able to apply AND filter', function(done){
        var q = 'filter[and][0][email]=test@test.com&filter[and][1][name]=match';
        createSocket(q, function(err){
          should.not.exist(err);
          var callCount = 0;
          var callEmails = [];
          socket.on('add', function(data){
            callEmails.push(data.people[0].email);
            callCount++;
          });
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com',
                name: 'match'
              },{
                email: 'dummy@test.com',
                name: 'match'
              }]
            }))
            .end(function(err, res){
              should.not.exist(err);
              setTimeout(function(){
                callCount.should.equal(1);
                callEmails.should.eql(['test@test.com']);
                done();
              }, 100);
            });
        });
      });
      it('should be able to apply OR filter', function(done){
        var q = 'filter[or][0][email]=test@test.com&filter[or][1][name]=catch';
        createSocket(q, function(err){
          should.not.exist(err);
          var callCount = 0;
          var callEmails = [];
          socket.on('add', function(data){
            callEmails.push(data.people[0].email);
            callCount++;
          });
          request(baseUrl).post('/people')
            .set('content-type', 'application/json')
            .send(JSON.stringify({
              people: [{
                email: 'test@test.com',
                name: 'match'
              },{
                email: 'matched@test.com',
                name: 'catch'
              },{
                email: 'dummy@test.com',
                name: 'match'
              }]
            }))
            .end(function(err, res){
              should.not.exist(err);
              setTimeout(function(){
                callCount.should.equal(2);
                callEmails.should.eql(['test@test.com', 'matched@test.com']);
                done();
              }, 100);
            });
        });
      });
    });
    describe('includes' , function(){
      var socket, createSocket;
      beforeEach(function(){
        createSocket = function(qs, done){
          socket = io.connect("http://localhost:" + options.ioPort + "/people", {query: qs, forceNew: true});
          socket.on('connect', done);
          socket.on('error', done);
        }
      });
      afterEach(function(){
        socket.off('add');
        socket.off('update');
        socket.off('delete');
      });
      it('should be able to include related documents to the same payload', function(done){
        createSocket('include=pets',function(err){
          should.not.exist(err);
          socket.on('update', function(data){
            data.people.should.be.an.Array;
            data.linked.should.be.an.Object;
            data.linked.pets.should.be.an.Array;
            data.linked.pets.length.should.equal(2);
            done();
          });
          request(baseUrl).patch('/people/' + ids.people[0])
            .set('content-type', 'application/json')
            .send(JSON.stringify([
              {op: 'replace', path: '/people/0/pets', value: [ids.pets[0], ids.pets[1]]}
            ]))
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
            });
        });
      });
    });
  });
};