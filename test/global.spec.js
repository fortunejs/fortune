#!/usr/bin/env node
'use strict';

var options = {
    adapter: 'mongodb',
    connectionString: process.env.MONGODB_URL,
    db: 'testDB',
    inflect: true
};

before(function (done) {
    this.app = require('./app')(options)
        .catch(function (error) {
            done(error);
            process.exit(1);
        });
    done();
});
after(function (done) {
    this.app
        .then(function (fortuneApp) {
            fortuneApp.router.close();
            this.app = null;
        })
        .finally(function () {
            done();
        });
});
