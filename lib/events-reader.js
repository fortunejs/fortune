var _ = require('lodash'),
    _s = require('underscore.string'),
    inflect = require('i')(),
    RSVP = require('rsvp'),
    debug = require('debug')('events-reader'),
    BSON = require('mongodb').BSONPure,
    mongojs = require('mongojs');


module.exports = function (harvesterApp) {

    return function (oplogMongodbUri) {

        var opMap = {
            "i": "insert",
            "u": "update",
            "d": "delete"
        };

        var db = mongojs(oplogMongodbUri);

        function EventsReader() {
        }

        EventsReader.prototype.stop = function() {
            this.stopRequested = true;
            return this.stopped.promise;
        };

        EventsReader.prototype.tail = function() {

            this.stopRequested = false;
            this.stopped = RSVP.defer();

            var that = this;

            return harvesterApp.adapter.find('checkpoint', {})
                .then(function (checkpoint) {
                    if (!checkpoint) {
                        debug('checkpoint missing, creating... ');
                        harvesterApp.adapter.create('checkpoint', {ts: BSON.Timestamp(0, Date.now() / 1000)})
                            .then(function () {
                                //If a stop was requested just before here, then tailing would no longer be correct!
                                if(!that.stopRequested){
                                    that.streamDestroyed=false;
                                    that.tail();
                                }
                            });
                    }else{
                        debug('reading with checkpoint');
                        logTs(checkpoint.ts);

                        that.checkpoint = checkpoint;
                        that.stream = that.oplogStream(oplogMongodbUri, checkpoint.ts);
                        that.streamDestroyed=false;
                        setTimeout(that.read.bind(that), 0);
                    }
                })
                .catch(function (err) {
                    that.exit(err);
                });

        };

        EventsReader.prototype.read = function() {

            var that = this;

            var doc;
            doc = that.stream.read();

            var promises = that.processDocHandlers(doc);

            RSVP.all(promises)
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
                , coll = db.collection('oplog.rs')
                , options = {
                    tailable: true,
                    awaitData: true
                };

            time = {$gt: since};
            query.ts = time;

            return coll.find(query, options);

        };

        EventsReader.prototype.processDocHandlers = function(doc) {
            var that = this;
            var promises = [];

            if (doc != null) {

                debug('got data from oplog ' + JSON.stringify(doc));
                logTs(doc.ts);

                _.forOwn(harvesterApp.changeHandlers, function (changeHandlers, key) {

                    _.forEach(changeHandlers, function (changeHandler) {

                        var resource = inflect.pluralize(key);
                        var regex = new RegExp('.*\\.' + resource, 'i');
                        var match = regex.test(doc.ns);

                        var dfd = RSVP.defer();

                        function checkFilterExecuteHandler(id, dfd, opFn, changeHandlerOp, doc) {
                            var filter = 'o.$set.' + opFn.filter;

                            debug('filtering on ' + filter);

                            var test = _.has(doc, filter, false);

                            debug('filter exists ' + test);

                            if (test) {
                                return executeHandler(id, dfd, opFn.func, changeHandlerOp, doc);
                            }

                            return;
                        }

                        function executeHandler(id, dfd, opFn, changeHandlerOp, doc) {
                            debug('processing resource op ' + changeHandlerOp);

                            new RSVP.Promise(function (resolve, reject) {
                                resolve(opFn(id));
                            })
                            .then(function () {
                                dfd.resolve(doc);
                            })
                            .catch(function (err) {
                                console.trace(err);
                                debug('onChange handler raised an error, retrying in 500ms.');
                                setTimeout(processWithHandler, 500, doc);
                            });
                        }

                        function processWithHandler(doc) {

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
                                    executeHandler(id, dfd, opFn, changeHandlerOp, doc);
                                } else if (opFn && typeof(opFn.func) === "function") {
                                    checkFilterExecuteHandler(id, dfd, opFn, changeHandlerOp, doc);
                                } else {
                                    that.skip(dfd, doc)
                                }

                            } else {
                                that.skip(dfd, doc);
                            }
                        }

                        if (match) {
                            promises.push(dfd.promise);
                            debug('matched resource ' + resource);
                            processWithHandler(doc);
                        }

                    });
                });
            }
            return promises;
        };

        EventsReader.prototype.skip = function(dfd, doc) {
            debug('skipping doc ' + JSON.stringify(doc));
            dfd.resolve(true);
        };

        EventsReader.prototype.updateCheckpointAndReschedule = function(doc) {
            var that = this;
            if (doc != null) {

                var regexCheckpoint = new RegExp('.*\\.checkpoints', 'i');
                var matchCheckpoint = regexCheckpoint.test(doc.ns);

                if (!matchCheckpoint) {

                    debug('updating checkpoint');
                    var ts = doc.ts;
                    logTs(ts);

                    return harvesterApp.adapter.update('checkpoint', that.checkpoint.id, {ts: ts})
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

        EventsReader.prototype.reschedule = function(time) {
            if (!this.stopRequested) {
                setTimeout(this.read.bind(this), time);
            } else {
                try {
                    if(!this.streamDestroyed){
                        this.stream.destroy();
                    }
                    this.streamDestroyed=true;
                    this.stopped.resolve();
                } catch (e) {
                    this.stopped.reject(e);
                }
            }
        };

        EventsReader.prototype.exit = function(err) {
            console.trace(err);
            debug('error occurred, force exit in order to respawn process');
            process.exit(-1);
        };


        function logTs(ts) {
            debug('ts ' + ts.getHighBits() + ' ' + ts.getLowBits() + ' ' +
            new Date((ts.getHighBits() - 1) * 1000));
        }

        return new RSVP.Promise(function (resolve) {
            harvesterApp.resource('checkpoint', {
                ts: Object
            });
            resolve(EventsReader);
        });

    }
};
