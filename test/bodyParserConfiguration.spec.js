var _ = require('lodash');
var expect = require('chai').expect;
var supertest = require('supertest');
var harvester = require('../lib/harvester');
var config = require('./config.js');

function configureApp(options, port) {
    var harvesterApp = harvester(options);
    harvesterApp.router.post('/hugebody', function (req, res) {
        res.send();
    });
    harvesterApp.listen(port);
    return harvesterApp;
}

describe('bodyParser configuration', function () {

    var payload100kb;
    var payload200kb;
    var payload300kb;

    before(function () {
        var surroundingJsonStringLength = 8;
        payload100kb = JSON.stringify({a: _.fill(new Array(100000 - surroundingJsonStringLength), 'a').join('')});
        payload200kb = JSON.stringify({a: _.fill(new Array(200000 - surroundingJsonStringLength), 'a').join('')});
        payload300kb = JSON.stringify({a: _.fill(new Array(300000 - surroundingJsonStringLength), 'a').join('')});
        expect(Buffer.byteLength(payload100kb)).to.equal(100000);
        expect(Buffer.byteLength(payload200kb)).to.equal(200000);
        expect(Buffer.byteLength(payload300kb)).to.equal(300000);
    });

    describe('when body parser configuration is not provided in options', function () {
        var baseUrl;

        before(function () {
            var options = _.cloneDeep(config.harvester.options);
            delete options.bodyParser;
            var port = 8002;
            this.harvesterApp = configureApp(options, port);
            baseUrl = 'http://localhost:' + port;
        });

        describe('and request payload is 100kb', function () {
            it('should respond with 200', function (done) {
                supertest(baseUrl).post('/hugebody').set('Content-type', 'application/json').send(payload100kb).expect(200).end(done);
            });
        });

        describe('and request payload is above 100kb', function () {
            it('should respond with 413 entity too large', function (done) {
                supertest(baseUrl).post('/hugebody').set('Content-type', 'application/json').send(payload200kb).expect(413).end(done);
            });
        });
    });
    describe('when body parser configuration is provided in options with limit set to 200kb', function () {
        var baseUrl;

        before(function () {
            var options = _.cloneDeep(config.harvester.options);
            options.bodyParser = {limit: '200kb'};
            var port = 8003;
            this.harvesterApp = configureApp(options, port);
            baseUrl = 'http://localhost:' + port;
        });

        describe('and request payload is 200kb', function () {
            it('should respond with 200', function (done) {
                supertest(baseUrl).post('/hugebody').set('Content-type', 'application/json').send(payload200kb).expect(200).end(done);
            });
        });
        describe('and request payload is above 200kb', function () {
            it('should respond with 413 entity too large', function (done) {
                supertest(baseUrl).post('/hugebody').set('Content-type', 'application/json').send(payload300kb).expect(413).end(done);
            });
        });
    });
});
