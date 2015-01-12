var _ = require('lodash'),
    _s = require('underscore.string'),
    inflect = require('i')(),
    RSVP = require('rsvp'),
    debug = require('debug')('events-reader'),
    BSON = require('mongodb').BSONPure,
    mongojs = require('mongojs');


module.exports = function (fortuneApp) {

    return function (oplogMongodbUri) {

        var opMap = {
            "i": "insert",
            "u": "update",
            "d": "delete"
        };

        var db = mongojs(oplogMongodbUri);

        var oplogStream = function (oplogMongodbUri, since) {

            var time
                , query = {}
                , coll = db.collection('oplog.rs')
                , options = {
                    tailable: true,
                    timeout: false
                };

            time = { $gt: since };
            query.ts = time;

            return coll.find(query, options);

        };

        function logTs(ts) {
            debug('ts ' + ts.getHighBits() + ' ' + ts.getLowBits() + ' ' +
                new Date((ts.getHighBits() - 1) * 1000));
        }

        var stopped;

        function stop() {
            stopRequested = true;
            return stopped.promise;
        }

        function tail() {

            stopRequested = false;
            stopped = RSVP.defer();

            return fortuneApp.adapter.find('checkpoint', {})
                .then(function (checkpoint) {

                    debug('reading with checkpoint');
                    logTs(checkpoint.ts);

                    var processing;

                    var stream = oplogStream(oplogMongodbUri, checkpoint.ts);

                    function read() {

                        var doc;

                        doc = stream.read();

                        var promises = [];

                        if (doc != null) {

                            debug('got data from oplog ' + JSON.stringify(doc));
                            logTs(doc.ts);

                            _.forOwn(fortuneApp.changeHandlers, function (changeHandlers, key) {

                                _.forEach(changeHandlers, function (changeHandler) {

                                    var resource = inflect.pluralize(key);
                                    var regex = new RegExp('.*\\.' + resource, 'i');
                                    var match = regex.test(doc.ns);

                                    var dfd = RSVP.defer();

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
                                            var opFn = changeHandler[ changeHandlerOp];
                                            if (opFn) {
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
                                            } else {
                                               debug('skipping resource op ' + changeHandlerOp);
                                               dfd.resolve(true);
                                            }

                                        } else {
                                            debug('skipping op ' + op)
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

                        RSVP.all(promises)
                            .then(function (docs) {

                                if (doc != null) {

                                    var regexCheckpoint = new RegExp('.*\\.checkpoints', 'i');
                                    var matchCheckpoint = regexCheckpoint.test(doc.ns);

                                    if(!matchCheckpoint) {

                                        debug('updating checkpoint');
                                        var ts = doc.ts;
                                        logTs(ts);
                                        return fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: ts})
                                            .then(function () {
                                                checkStopAndReschedule();
                                            });
                                    }

                                }

                                checkStopAndReschedule();


                                function checkStopAndReschedule() {
                                    if (!stopRequested) {
                                        var time = 0;
                                        if (!doc) {
                                            time = 1000;
                                        }
                                        setTimeout(read, time);
                                    } else {
                                        try {
                                            stream.end();
                                            stopped.resolve();
                                        } catch (e) {
                                            stopped.reject(e);
                                        }
                                    }
                                }

                            })
                            .catch(function (err) {
                                exit(err);
                            });
                    }

                    setTimeout(read, 0);

                })
                .catch(function (err) {
                    if (!err) {
                        console.warn('checkpoint missing, creating... ');
                        fortuneApp.adapter.create('checkpoint', {ts: BSON.Timestamp(0, Date.now() / 1000)})
                            .then(function () {
                                tail();
                            });
                    } else {
                        exit(err);
                    }
                });

        }


        return fortuneApp
            .resource('checkpoint', {
                ts: Object
            })
            .onRouteCreated()
            .then(function () {
                return {
                    tail: tail,
                    stop: stop
                };
            })
            .catch(function (err) {
                exit(err);
            });

        function exit(err) {
            console.trace(err);
            debug('error occurred, force exit in order to respawn process');
            process.exit(-1);
        }

    }
};














