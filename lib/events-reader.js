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

    var oplogStream = function (oplogMongodbUri, since) {

        var db = mongojs(oplogMongodbUri);


        var time
            , query = {}
            , coll = db.collection('oplog.rs')
            , options = {
                tailable: true,
                timeout: false
            };

        time = { $gte: since };
        query.ts = time;

        var stream = coll.find(query, options);
        return stream;

    };

    function logTs(ts) {
        debug('ts ' + ts.getHighBits() + ' ' + ts.getLowBits() + ' ' +
            new Date((ts.getHighBits() - 1) * 1000));
    }

    function tail() {

        return fortuneApp.adapter.find('checkpoint', {})
            .then(function (checkpoint) {

                debug('reading with checkpoint');
                logTs(checkpoint.ts);

                var processing;

                var stream = oplogStream(oplogMongodbUri, checkpoint.ts);

                function whenReadable() {
                    var doc;
                    if (!processing) {

                        processing = true;
                        debug('processing ' + processing);

                        while (null !== (doc = stream.read())) {

                            debug('got data from oplog ' + JSON.stringify(doc));

                            _.forOwn(fortuneApp.changeHandlers, function (changeHandlers, key) {

                                _.forEach(changeHandlers, function (changeHandler) {

                                    var resource = inflect.pluralize(key);
                                    var regex = new RegExp('.*\\.' + resource, 'i');
                                    var match = regex.test(doc.ns);

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
                                                var resultPromise = fn(id);
                                                resultPromise
                                                    .then(function () {
                                                        debug('updating checkpoint');
                                                        var ts = doc.ts;
                                                        logTs(ts);
                                                        return fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: ts});
                                                    }).catch(function (err) {
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
                        }
                        processing = false;
                        debug('processing ' + processing);

                    }
                }

                stream.on('readable', function () {
                    debug('readable event detected');
                    whenReadable();
                });

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
                tail: tail
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














