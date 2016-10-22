var _ = require('lodash'),
    inflect = require('i')(),
    Promise = require('bluebird'),
    debug = require('debug')('events-reader'),
    BSON = require('mongodb').BSONPure,
    mongojs = require('mongojs'),
    hl = require('highland');
Joi = require('joi');


module.exports = function (harvesterApp) {

    return function (oplogMongodbUri, skip, success) {

        var opMap = {
            "i": "insert",
            "u": "update",
            "d": "delete"
        };

        var db = mongojs(oplogMongodbUri, ['oplog.rs'], {poolSize: 10, socketOptions: {keepAlive: 250}});

        var docStream = hl();

        function EventsReader() {
        }

        EventsReader.prototype.stop = function () {
            this.stopRequested = true;
            return this.stopped.promise;
        };

        EventsReader.prototype.tail = function () {

            this.stopRequested = false;
            this.stopped = Promise.defer();

            var that = this;

            return harvesterApp.adapter.find('checkpoint', {})
                .then(function (checkpoint) {
                    if (!checkpoint) {
                        debug('checkpoint missing, creating... ');
                        harvesterApp.adapter.create('checkpoint', {ts: BSON.Timestamp(0, Date.now() / 1000)})
                            .then(function () {
                                //If a stop was requested just before here, then tailing would no longer be correct!
                                if (!that.stopRequested) {
                                    that.streamDestroyed = false;
                                    that.tail();
                                }
                            });
                    } else {
                        debug('reading with checkpoint ' + logTs(checkpoint.ts));

                        that.checkpoint = checkpoint;
                        that.stream = that.oplogStream(oplogMongodbUri, checkpoint.ts);
                        that.streamDestroyed = false;
                        setTimeout(that.read.bind(that), 0);
                    }
                })
                .catch(function (err) {
                    that.exit(err);
                });

        };

        EventsReader.prototype.read = function () {

            var that = this;

            var doc;
            doc = that.stream.read();

            var promises = that.processDocHandlers(doc);

            Promise.all(promises)
                .then(function () {
                    return that.updateCheckpointAndReschedule(doc);
                })
                .catch(function (err) {
                    that.exit(err);
                });
        };

        EventsReader.prototype.oplogStream = function (oplogMongodbUri, since) {

            var time
                , query = {}
                , options = {
                    tailable: true,
                    awaitData: true,
                    timeout: false
                };

            time = {$gt: since};
            query.ts = time;

            return db.oplog.rs.find(query, options);

        };


        EventsReader.prototype.processDocHandlers = function (doc) {
            var that = this;
            var promises = [];

            if (doc != null) {

                debug('got data from oplog ' + JSON.stringify(doc) + ' ts: ' + logTs(doc.ts));

                var matchedChangeHandlers = matchChangeChandlers(harvesterApp.changeHandlers, doc.ns);
                _.forEach(matchedChangeHandlers, function (changeHandler) {


                        var asyncInMemory = changeHandler['asyncInMemory'];

                        if (!asyncInMemory) {
                            var dfd = Promise.defer();
                            promises.push(dfd.promise);
                            processWithHandlerT(that, changeHandler, doc, dfd);
                        } else {
                            _.delay(processWithHandlerT, 0, that, changeHandler, doc, null);
                        }


                });
            }
            return promises;
        };

        function matchChangeChandlers(changeHandlersPerResource, ns) {

            return _.chain(changeHandlersPerResource)
                .filter(function (changeHandler, resource) {
                    var resourcePlural = inflect.pluralize(resource);
                    var regex = new RegExp('.*\\.' + resourcePlural + '$', 'i');
                    return regex.test(ns);
                })
                .flatten()
                .value();
        }


        function processWithHandler(that, changeHandler, doc, dfd) {

            var op = doc.op;

            if (op === "i" || op === "u" || op === "d") {

                var id;
                if (op === "u") {
                    id = doc.o2._id;
                } else {
                    id = doc.o._id;
                }

                var changeHandlerOp = opMap[op];
                var opFn = changeHandler[changeHandlerOp];

                if (_.isFunction(opFn)) {
                    executeHandler(that, id, dfd, opFn, changeHandler, changeHandlerOp, doc);
                } else if (opFn && typeof(opFn.func) === "function") {
                    checkFilterExecuteHandler(that, id, dfd, opFn, changeHandler, changeHandlerOp, doc);
                } else {
                    if (that) {
                        that.skip(dfd, doc)
                    }
                }

            } else {
                if (that) {
                    that.skip(dfd, doc);
                }
            }
        }

        var throttle = require('throttle-function');
        var processWithHandlerT = throttle(processWithHandler, {
            // call a maximum of 100 times per 1s window
            window: 1,
            limit: parseInt(_.get(harvesterApp, 'options.eventsReaderThrottleLimit'), 10) || 100
        });


        function executeHandler(that, id, dfd, opFn, changeHandler, changeHandlerOp, doc) {
            debug('processing resource op ' + changeHandlerOp);

            new Promise(function (resolve) {
                resolve(opFn(id));
            })
                .then(function () {
                    if (dfd) {
                        dfd.resolve(doc);
                    }
                })
                .catch(function (err) {
                    console.trace(err);
                    debug('onChange handler raised an error, retrying in 500ms.');
                    _.delay(processWithHandlerT, 500, that, changeHandler, doc, dfd);
                });
        }


        function checkFilterExecuteHandler(that, id, dfd, opFn, changeHandler, changeHandlerOp, doc) {
            if (opFn.filter) {
                var filter = 'o.$set.' + opFn.filter;
                debug('filtering on ' + filter);
                var test = _.has(doc, filter, false);
                debug('filter exists ' + test);
                if (test) {
                    return executeHandler(that, id, dfd, opFn.func, changeHandler, changeHandlerOp, doc);
                } else {
                    return that.skip(dfd, doc);
                }
            }
            return executeHandler(that, id, dfd, opFn.func, changeHandler, changeHandlerOp, doc);
        }


        EventsReader.prototype.skip = function (dfd, doc) {
            debug('skipping doc ' + JSON.stringify(doc));
            if (dfd) {
                dfd.resolve(true);
            }
        };

        EventsReader.prototype.updateCheckpointAndReschedule = function (doc) {
            var that = this;
            if (doc != null) {

                var regexCheckpoint = new RegExp('.*\\.checkpoints$', 'i');
                var matchCheckpoint = regexCheckpoint.test(doc.ns);

                if (!matchCheckpoint) {

                    debug('updating checkpoint with ts: ' + logTs(doc.ts));

                    return harvesterApp.adapter.update('checkpoint', that.checkpoint.id, {ts: doc.ts})
                        .then(function () {
                            that.reschedule(0);
                        });

                } else {
                    that.reschedule(0);
                }
            } else {
                that.reschedule(0);
            }
        };

        EventsReader.prototype.reschedule = function (time) {
            if (!this.stopRequested) {
                setTimeout(this.read.bind(this), time);
            } else {
                try {
                    if (!this.streamDestroyed) {
                        this.stream.destroy();
                    }
                    this.streamDestroyed = true;
                    this.stopped.resolve();
                } catch (e) {
                    this.stopped.reject(e);
                }
            }
        };

        EventsReader.prototype.exit = function (err) {
            console.log(err);
            debug('error occurred, force exit in order to respawn process');
            process.exit(1);
        };


        function logTs(ts) {
            return (ts.getHighBits() + ' ' + ts.getLowBits() + ' ' +
            new Date((ts.getHighBits()) * 1000));
        }

        docStream.map(function (doc) {
            var matched = matchChangeChandlers(harvesterApp.changeHandlers, doc.ns);
            _.forEach(matched, function (changeHandler) {
                processWithHandlerT(null, changeHandler, doc, null);
            });
        }).parallel(100);


        return new Promise(function (resolve) {
            if (!harvesterApp.adapter.model('checkpoint')) {
                harvesterApp.resource('checkpoint', {
                    ts: Joi.any()
                });
            }
            resolve(EventsReader);
        });

    }
};
