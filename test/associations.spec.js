var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var seeder = require('./seeder.js');


describe('associations', function () {

    var config, ids;
    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets').then(function (_ids) {
            ids = _ids;
        });
    });

    describe('many to one association', function () {
        it('should be able to associate', function (done) {

            new Promise(function (resolve) {
                var payload = {};

                payload.people = [
                    {
                        id: ids.people[0],
                        name: "Dilbert",
                        appearances: 5000,
                        links: {
                            pets: [ids.pets[0]]
                        }
                    }
                ];

                request(config.baseUrl).put('/people/' + ids.people[0]).send(payload).expect('Content-Type', /json/).expect(200).end(function (error,
                                                                                                                                               response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    (body.people[0].links.pets).should.containEql(ids.pets[0]);
                    resolve();
                });
            }).then(function () {
                    request(config.baseUrl).get('/pets/' + ids.pets[0]).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                        should.not.exist(error);
                        var body = JSON.parse(response.text);
                        (body.pets[0].links.owner).should.equal(ids.people[0]);
                        done();
                    });
                });
        });
    });

    describe('one to many association', function () {
        it('should be able to associate', function (done) {
            new Promise(function (resolve) {
                var payload = {};

                payload.pets = [
                    {
                        id: ids.pets[0],
                        name: "Dogbert",
                        appearances: 1000,
                        links: {
                            owner: ids.people[0]
                        }
                    }
                ];

                request(config.baseUrl).put('/pets/' + ids.pets[0]).send(payload).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    should.equal(body.pets[0].links.owner, ids.people[0]);
                    resolve();
                });
            }).then(function () {
                    request(config.baseUrl).get('/people/' + ids.people[0]).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                        should.not.exist(error);
                        var body = JSON.parse(response.text);
                        (body.people[0].links.pets).should.containEql(ids.pets[0]);
                        done();
                    });
                });
        });
    });

    describe('one to one association', function () {
        it('should be able to associate', function (done) {
            new Promise(function (resolve) {
                var payload = {};

                payload.people = [
                    {
                        id: ids.people[0],
                        name: "Dilbert",
                        appearances: 5000,
                        links: {
                            soulmate: ids.people[1]
                        }
                    }
                ];

                request(config.baseUrl).put('/people/' + ids.people[0]).send(payload).expect('Content-Type', /json/).expect(200).end(function (error,
                                                                                                                                               response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    should.equal(body.people[0].links.soulmate, ids.people[1]);
                    resolve();
                });
            }).then(function () {
                    request(config.baseUrl).get('/people/' + ids.people[1]).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                        should.not.exist(error);
                        var body = JSON.parse(response.text);
                        (body.people[0].links.soulmate).should.equal(ids.people[0]);
                        done();
                    });
                });
        });
    });

    describe('many to many association', function () {
        it('should be able to associate', function (done) {
            new Promise(function (resolve) {
                var payload = {};

                payload.people = [
                    {
                        id: ids.people[0],
                        name: "Dilbert",
                        appearances: 5000,
                        links: {
                            lovers: [ids.people[1]]
                        }
                    }
                ];

                request(config.baseUrl).put('/people/' + ids.people[0]).send(payload).expect('Content-Type', /json/).expect(200).end(function (error,
                                                                                                                                               response) {
                    should.not.exist(error);
                    var body = JSON.parse(response.text);
                    (body.people[0].links.lovers).should.containEql(ids.people[1]);
                    resolve();
                });
            }).then(function () {
                    request(config.baseUrl).get('/people/' + ids.people[1]).expect('Content-Type', /json/).expect(200).end(function (error, response) {
                        should.not.exist(error);
                        var body = JSON.parse(response.text);
                        (body.people[0].links.lovers).should.containEql(ids.people[0]);
                        done();
                    });
                });
        });
    });

});
