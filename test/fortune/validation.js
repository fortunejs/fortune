'use strict';
var should = require('should');
var request = require('supertest');
var fortune = require('../../lib/fortune')

module.exports = function(options) {

	var app, baseUrl, ids;

	describe('Resource validation', function() {

		before(function() {
			baseUrl = options.baseUrl;
			app = options.app;
			ids = options.ids
			app._validators = {};
			app._resources['person'].schema['name'] = {
				type: app._resources['person'].schema['name'],
				validation : {
					presence: true,
					exclusion: {
						within: ["John", "Peter"],
						message: "'%{value}' is not allowed"
					} 
				}
			};
		});

		after(function() {
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

		it('should prevent creation of an invalid resource via POST', function(done) {
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

		it('should allow creation of a valid resource via POST', function(done) {
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

		it('should prevent PATCH with an invalid value', function(done) {
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

		it('should allow PATCH with a valid value', function(done) {
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

		it('should receive an error response in correct format when POSTing', function(done) {
			request(baseUrl)
			.post('/people')
			.set('content-type', 'application/json')
			.send(JSON.stringify({people: [{ "name": "", "password": "qwerty", "email": "test@example.com"}]}))
			.end(function(error, response) {
				response.body.should.have.keys(['error', 'detail']);
				response.body.detail.should.equal("Error: Validation error: Name can't be blank");
				done();
			});
		});

		it('should receive an error response in correct format when PATCHing', function(done) {
			request(baseUrl)
			.patch('/people/' + ids.people[0])
			.set('content-type', 'application/json')
			.send(JSON.stringify([{ "path" : "/people/0/name", "op": "replace", "value": "Peter" }]))
			.end(function(error, response) {
				response.body.should.have.keys(['error', 'detail']);
				response.body.detail.should.equal("Error: Validation error: Name 'Peter' is not allowed");
				done();
			});
		});

	});

};