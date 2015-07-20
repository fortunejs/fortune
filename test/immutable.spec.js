var should = require('should');
var supertest = require('supertest');
var seeder = require('./seeder.js');

describe('Immutable', function () {

    var config;
    var ids;

    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('immutables').then(function (_ids) {
            ids = _ids;
        });
    });

    it('should be possible to post', function (done) {
        var data = {
            immutables: [
                {name: 'Jack'}
            ]
        };
        supertest(config.baseUrl).post('/immutables').send(data).expect('Content-Type', /json/).expect(201).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should be possible to get', function (done) {
        supertest(config.baseUrl).get('/readers').expect('Content-Type', /json/).expect(200).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should be possible to getById', function (done) {
        supertest(config.baseUrl).get('/immutables/' + ids.immutables[0]).expect('Content-Type', /json/).expect(200).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to deleteById', function (done) {
        supertest(config.baseUrl).delete('/immutables/' + ids.immutables[0]).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to putById', function (done) {
        var data = {
            immutables: [
                {name: 'Duck'}
            ]
        };
        supertest(config.baseUrl).put('/immutables/' + ids.immutables[0]).send(data).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

    it('should NOT be possible to patchById', function (done) {
        var data = [
            {
                op: 'replace',
                path: '/immutables/0/name',
                value: 'Baba Jaga'
            }
        ];
        supertest(config.baseUrl).patch('/immutables/' + ids.immutables[0]).send(data).expect('Content-Type', /json/).expect(405).end(function (error) {
            should.not.exist(error);
            done();
        });
    });

});
