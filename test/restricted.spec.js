var should = require('should');
var supertest = require('supertest');
var Joi = require('joi');
var harvester = require('../lib/harvester');
var seeder = require('./seeder.js');

describe('Restricted', function () {

    var config;

    before(function () {
        config = this.config;
    });

    it('should NOT be possible to post', function (done) {
        var data = {
            restricts: [
                {name: 'Jack'}
            ]
        };
        supertest(config.baseUrl).post('/restricts').send(data)
            .expect('Content-Type', /json/).expect(405)
            .end(function (error) {
            console.log(error);
                should.not.exist(error);
            done();
        });
    });

    it('should not be possible to get', function (done) {
        supertest(config.baseUrl).get('/restricts').expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should not be possible to getById', function (done) {
        supertest(config.baseUrl).get('/restricts/' + 1).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to deleteById', function (done) {
        supertest(config.baseUrl).delete('/restricts/' + 1).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to putById', function (done) {
        var data = {
            restricts: [
                {name: 'Duck'}
            ]
        };
        supertest(config.baseUrl).put('/restricts/' + 1).send(data).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to patchById', function (done) {
        var data = [
            {
                op: 'replace',
                path: '/restricts/0/name',
                value: 'Baba Jaga'
            }
        ];
        supertest(config.baseUrl).patch('/restricts/' + 1).send(data).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

});
