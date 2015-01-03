var inflect = require('i')();
var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var baseUrl = 'http://localhost:' + process.env.PORT;


describe('onChange', function () {

    before(function (done) {
        this.app
            .then(function (fortuneApp) {

                setTimeout(function () {
                    var reader = require('../../lib/events-reader');
                    reader(fortuneApp, process.env.OPLOG_MONGODB_URL);
                }, 100);
                done();
            })
            .catch(function (err) {
                console.trace(err);
                done();
            })
    });

    describe('simple', function () {
        it('should be simple', function (done) {
            this.timeout(300000);
            this.app
                .then(function (fortuneApp) {
                    fortuneApp.adapter.create('blas', {name: 'blabla'});
                })
        });
    });
});


