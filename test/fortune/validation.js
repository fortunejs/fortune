'use strict';
var should = require('should');
var request = require('supertest');
var fortune = require('../../lib/fortune')

module.exports = function(options) {

	var app, baseUrl, ids;

	describe('Resource validation', function() {

		before(function(){
    	baseUrl = options.baseUrl;
    	app = options.app;
    	ids = options.ids
    	app._validators = {};
    	app._resources['person'].schema['name'] = { type: app._resources['person'].schema['name'],
    																							validation : {
    																									presence: true,
    																									exclusion: {
    																										within: ["John","Peter"],
    																										message: "'%{value}' is not allowed"
    																									} 
    																								}
    																							};
  	});

  	after(function(){
  		app._resources['person'].schema['name'] = app._resources['person'].schema['name'].type;
  	});

  	afterEach(function() {
  		app._validators = {};
  	});

	  it('should add validator to the list', function(done) {
	    app.addValidator('petAge', { numericality : { moreThan : 0, lessThan: 30 } });
	    app.addValidator('noJohns', { exclusion : { within: ["John"] } });
	    app._validators.should.have.keys(['petAge', 'noJohns']);
	    done();
	  });

	  it('should prevent from creating this resource', function(done) {
	    request(baseUrl)
	      .post('/people')
	      .expect(403)
	      .set('content-type', 'application/json')
	      .send(JSON.stringify({people: [{ "name": "Peter", "password": "qwerty", "email": "test@example.com"}]}))
	      .end(function(error, response) {
	        if(error) return done(error);
	        done();
	      });
	  });

	  it('should allow to create this resource', function(done) {
	    request(baseUrl)
	      .post('/people')
	      .expect(201)
	      .set('content-type', 'application/json')
	      .send(JSON.stringify({people: [{ "name": "Aaron", "password": "qwerty", "email": "test@example.com"}]}))
	      .end(function(error, response) {
	        if(error) return done(error);
	        done();
	      });
	  });

	  it('should prevent from updating this resource', function(done) {
	    request(baseUrl)
	      .patch('/people/' + ids.people[0])
	      .expect(403)
	      .set('content-type', 'application/json')
	      .send(JSON.stringify([{ "path" : "/people/0/name", "op": "replace", "value": "" }]))
	      .end(function(error, response) {
	        if(error) return done(error);
	        done();
	      });
	  });

	  it('should allow to update this resource', function(done) {
	    request(baseUrl)
	      .patch('/people/' + ids.people[0])
	      .expect(200)
	      .set('content-type', 'application/json')
	      .send(JSON.stringify([{ "path" : "/people/0/name", "op": "replace", "value": "Chris" }]))
	      .end(function(error, response) {
	        if(error) return done(error);
	        done();
	      });
	  });

	});

};