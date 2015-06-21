var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;
var fixtures = require('./fixtures');

var seeder = require('./seeder.js');


describe('resources', function () {

    var config, ids;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets').then(function (_ids) {
            ids = _ids;
        });
    });

    describe('getting a list of resources', function () {
        _.each(ids, function (resources, key) {

            it('in collection "' + key + '"', function (done) {
                request(config.baseUrl).get('/' + key).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    ids[key].forEach(function (id) {
                        _.contains(_.pluck(body[key], 'id'), id).should.equal(true);
                    });
                    done();
                });
            });
        });
    });

    describe('getting each individual resource', function () {
        _.each(ids, function (resources, key) {

            it('in collection "' + key + '"', function (done) {
                RSVP.all(ids[key].map(function (id) {
                        return new Promise(function (resolve) {
                            request(config.baseUrl).get('/' + key + '/' + id).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                                should.not.exist(error);
                                var body = JSON.parse(response.text);
                                body[key].forEach(function (resource) {
                                    (resource.id).should.equal(id);
                                });
                                resolve();
                            });
                        });
                    })).then(function () {
                        done();
                    });
            });
        });
    });

    describe('posting a duplicate resource', function () {
        it('in collection \'people\'', function (done) {
            var body = {people: []};
            body.people.push(_.cloneDeep(fixtures().people[0]));
            body.people[0].id = ids.people[0];
            RSVP.all([ids.people[0]].map(function () {
                    return new Promise(function (resolve) {
                        request(config.baseUrl).post('/people/').send(body).expect('Content-Type', /json/).expect(409).end(function (error, response) {
                            should.not.exist(error);
                            should.exist(response.error);
                            resolve();
                        });
                    });
                })).then(function () {
                    done();
                });
        });
    });

    describe('posting a resource with a namespace', function () {
        it('should post without a special key', function (done) {
            var cat = {
                name: 'Spot'
            }, body = {cats: []};
            body.cats.push(cat);
            return new Promise(function () {
                request(config.baseUrl).post('/animals/cats').send(body).expect('Content-Type', /json/).expect(201).end(done);
            }).then(done);
        });
    });
});
