var MongoOplog = require('mongo-oplog'),
    _ = require('lodash'),
    inflect = require('i')();


module.exports = function (fortuneApp, oplogMongodbUri) {

    function tail() {

        return fortuneApp.adapter.find('checkpoint', {})
            .then(function (checkpoint) {

                var oplog = MongoOplog(oplogMongodbUri, '', {since: !checkpoint.ts});

                _.forOwn(fortuneApp.changeHandlers, function (changeHandlerFns, key) {

                    _.forEach(changeHandlerFns, function (changeHandlerFn) {
                        oplog
                            .filter()
                            .ns('*.' + inflect.pluralize(key))
                            .on('op', function (doc) {
                                try {
                                    changeHandlerFn(doc);
                                    fortuneApp.adapter.update('checkpoint', checkpoint.id, {ts: doc.ts})
                                    // todo wrap in promise
                                } catch (err) {
                                    console.trace(err);
                                    stopAndReschedule(oplog);
                                }
                            });
                    })
                });

                oplog
                    .on('error', function (err) {
                        console.trace(err);
                        stopAndReschedule(oplog);

                    })
                    .on('end', function () {
                        console.log('Stream ended');
                        stopAndReschedule(oplog);
                    })
                    .tail();


            })
            .catch(function (err) {
                if (!err) {
                    fortuneApp.adapter.create('checkpoint', {ts: new Date()})
                        .then(function () {
                            tail();
                        });
                } else {
                    if (!oplog) {
                        console.trace(err);
                        stopAndReschedule(oplog);
                    } else {
                        throw err;
                    }
                }
            });

    }


    fortuneApp
        .resource('checkpoint', {
            ts: Date
        })
        .onRouteCreated()
        .then(function () {
            tail(fortuneApp);
        })
        .catch(function (err) {
            console.trace(err);
            setTimeout(tail, 500);
        });

    function stopAndReschedule(oplog) {
        oplog.stop(function () {
            setTimeout(tail, 500);
        });
    }
}













