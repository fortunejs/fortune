/**
 * Unit tests for the send-error module
 *
 *
 */
'use strict';

// dependencies
var should = require('should');
var JsonApiError = require('../lib/jsonapi-error');


// module under test
var sendError = require('../lib/send-error');


describe('function sendError', function () {
    var req;
    var res;
    var error;


    // helper functions
    function mockFunc() {
        return res;
    }

    function standardJsonApiErrorValidation(body) {
        var json;

        should.exist(body);
        body.should.be.a.String;
        json = JSON.parse(body);
        should.exist(json.errors);
        json.errors.should.be.an.Array;
        json.errors.length.should.be.greaterThan(0);
        return json;
    }


    beforeEach(function () {
        // Shortened timeouts as there is a catch in `sendError` that swallows
        // errors thrown by `should` in the mocked `res` functions. Thus
        // causing these tests to fail by timeout, which is currently set to
        // 50 seconds.
        this.timeout(100);
        req = {};
        res = {
            set: mockFunc,
            send: mockFunc,
            status: mockFunc
        };
        error = new JsonApiError({ status: '400' });
    });

    it('should accept a harvester#jsonapi-error object as it\'s third argument', function (done) {
        res.send = function (body) {
            standardJsonApiErrorValidation(body);
            done();
        };
        sendError(req, res, error);
    });
    it('should accept an array of harvester#jsonapi-error objects as it\'s third argument', function (done) {
        error = [ error ];
        res.send = function (body) {
            standardJsonApiErrorValidation(body);
            done();
        };
        sendError(req, res, error);
    });
    it('should accept an array of 3 harvester#jsonapi-error objects as it\'s third argument', function (done) {
        error = [ error, error, error ];
        res.send = function (body) {
            var body = standardJsonApiErrorValidation(body);
            body.errors.length.should.equal(3);
            done();
        };
        sendError(req, res, error);
    });
});
