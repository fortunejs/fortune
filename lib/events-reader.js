var MongoOplog = require('mongo-oplog'),
    _ = require('lodash'),
    inflect = require('i')(),
    RSVP = require('RSVP'),
    debug = require('debug')('events-reader'),
    BSON = require('mongodb').BSONPure;



var opMap = {
    "i":"insert",
    "u":"update",
    "d":"delete"
}


module.exports = function (fortuneApp, oplogMongodbUri) {

    function tail() {

        return fortuneApp.adapter.find('checkpoint', {})
            .then(function (checkpoint) {

                debug('checkpoint ts : ' + new Date((checkpoint.ts.getHighBits() - 1) * 1000));

                oplog = MongoOplog(oplogMongodbUri, '', {since: checkpoint.ts});

                _.forOwn(fortuneApp.changeHandlers, function (changeHandlers, key) {

                    _.forEach(changeHandlers, function (changeHandler) {

                        debug('setting up oplog for ' + key);

                        oplog
                            .filter()
                            .ns('*.' + inflect.pluralize(key).toLowerCase())
                            .on('op', function (doc) {

                                debug('received op doc ' + JSON.stringify(doc));

                                /** HACK code below is devised to integrate possible promises returned from changeHandler functions
                                 * and wait for both that promise and the checkpoint update to complete without reworking all of
                                 * mongo-oplog, which is coded callback style
                                 *
                                 * */

                                // setup deasync guard
                                var done = false;
                                // start a promise chain
                                new RSVP.Promise(function (resolve, reject) {
                                    resolve();
                                })
                                    .then(function () {
                                        var op = doc.op;

                                        if (op === "i" || op === "u" || op === "d") {

                                            var id;
                                            if (op === "u") {
                                                id = doc.o2._id;
                                            } else {
                                                id = doc.o._id;
                                            }

                                            var fn = changeHandler[opMap[op]];
                                            if (fn) {
                                                var resultPromise = fn(id);
                                                return  resultPromise;
                                            }

                                        } else {
                                            debug('skipping op ' + op);
                                            return true;
                                        }

                                    })
                                    .then(function () {
                                        debug('update checkpoint with ts : ' + new Date(doc.ts.getHighBits() * 1000));
                                        return fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: doc.ts});
                                    })
                                    .catch(function (err) {
                                        exit(err, oplog);
                                    });

                               /* while (!done) {
                                    // check guard condition, exec non blocking node loop if not met
                                    debug('loop guard');
                                    require('deasync').runLoopOnce();
                                }*/
                            })

                    });
                });


                oplog
                    .on('error end', function (err) {
                        exit(err);
                    })
                    .tail();

                return true;

            })
            .catch(function (err) {
                if (!err) {
                    console.log('checkpoint missing, creating... ');
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














