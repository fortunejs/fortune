var MongoOplog = require('mongo-oplog'),
    _ = require('lodash'),
    inflect = require('i')(),
    RSVP = require('RSVP')
    , debug = require('debug')('events-reader');


module.exports = function (fortuneApp, oplogMongodbUri) {

    function tail() {

        return fortuneApp.adapter.find('checkpoint', {})
            .then(function (checkpoint) {

                debug('checkpoint ts : ' + new Date(checkpoint.ts.getHighBits() * 1000));

                var oplog = MongoOplog(oplogMongodbUri, '', {since: checkpoint.ts});

                _.forOwn(fortuneApp.changeHandlers, function (changeHandlerFns, key) {

                    _.forEach(changeHandlerFns, function (changeHandlerFn) {
                        oplog
                            .filter()
                            .ns('*.' + inflect.pluralize(key))
                            .on('op', function (doc) {

                                /** HACK code below is devised to integrate possible promises returned from changeHandlerFn
                                 * and wait for both that promise and the checkpoint update to complete without reworking all of
                                 * mongo-oplog, which is coded callback style
                                 * */

                                // setup deasync guard
                                var done = false;
                                // start a promise chain
                                new RSVP.Promise(function (resolve, reject) {
                                    resolve();
                                })
                                    .then(function () {
                                        return changeHandlerFn(doc);
                                    })
                                    .then(function () {
                                        debug('update checkpoint with ts ' + doc.ts.getHighBits() + ' ' + doc.ts.getLowBits());
                                        return fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: doc.ts});
                                    })
                                    .catch(function (err) {
                                        stopAndReschedule(err, oplog);
                                    })
                                    .finally(function () {
                                        // set guard to true, both promises have succeeded or thrown an err at this point
                                        debug('set guard to true');
                                        done = true;
                                    });

                                while (!done) {
                                    // check guard condition, exec non blocking node loop if not met
                                    debug('loop guard');
                                    require('deasync').runLoopOnce();
                                }
                            })

                    });
                });


                oplog
                    .on('error end', function (err) {
                        stopAndReschedule(err, oplog);
                    })
                    .tail();


            })
            .catch(function (err) {
                if (!err) {
                    console.log('checkpoint missing, creating... ');
                    fortuneApp.adapter.create('checkpoint', {})
                        .then(function () {
                            tail();
                        });
                } else {
                    if (!oplog) {
                        stopAndReschedule(err, oplog);
                    } else {
                        throw err;
                    }
                }
            });

    }


    fortuneApp
        .resource('checkpoint', {
            ts: Object
        })
        .onRouteCreated()
        .then(function () {
            tail(fortuneApp);
        })
        .catch(function (err) {
            console.trace(err);
            setTimeout(tail, 500);
        });

    function stopAndReschedule(err, oplog) {
        debug('error occurred, rescheduling the tail function');
        console.trace(err);
        oplog.stop(function () {
            setTimeout(tail, 500);
        });
    }
}













