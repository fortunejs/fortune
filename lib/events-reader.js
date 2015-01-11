var _ = require('lodash'),
    _s = require('underscore.string'),
    inflect = require('i')(),
    RSVP = require('RSVP'),
    debug = require('debug')('events-reader'),
    BSON = require('mongodb').BSONPure,
    mongojs = require('mongojs');


module.exports = function (fortuneApp, oplogMongodbUri) {

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

        time = { $gte: since };
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

                function whenReadable() {
                    var doc;

                    while (null !== (doc = stream.read())) {

                        var promises = [];

                        debug('got data from oplog ' + JSON.stringify(doc));

                        _.forOwn(fortuneApp.changeHandlers, function (changeHandlers, key) {

                            _.forEach(changeHandlers, function (changeHandler) {

                                var resource = inflect.pluralize(key);
                                var regex = new RegExp('.*\\.' + resource, 'i');
                                var match = regex.test(doc.ns);

                                var dfd = RSVP.defer();
                                promises.push(dfd.promise);

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
                                        var fn = changeHandler[ changeHandlerOp];
                                        if (fn) {
                                            debug('processing onChange ' + changeHandlerOp);
                                            fn(id)
                                                .then(function () {
                                                    dfd.resolve(doc);
                                                })
                                                .catch(function (err) {
                                                    console.trace(err);
                                                    debug('onChange handler raised an error, retrying in 500ms.');
                                                    setTimeout(processWithHandler, 500, doc);
                                                });
                                        }

                                    } else {
                                        debug('skipping op ' + op)
                                    }
                                }

                                if (match) {
                                    debug('matched resource ' + resource);
                                    processWithHandler(doc);
                                }

                            });
                        });

                        RSVP.all(promises)
                            .then(function (docs) {
                                if (doc != null) {
                                    debug('updating checkpoint');
                                    var ts = doc.ts;
                                    logTs(ts);
                                    return fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: ts});
                                }
                            })
                            .catch(function (err) {
                                exit(err);
                            });

                    }

                    if (!stopRequested) {
                        setTimeout(whenReadable, 500);
                    } else {
                        try {
                            stream.end();
                            stopped.resolve();
                        } catch (e) {
                            stopped.reject(e);
                        }
                    }
                }

                whenReadable();

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


};














