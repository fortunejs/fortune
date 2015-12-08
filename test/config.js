var harvesterPort = process.env.HARVESTER_PORT || 8000;

module.exports = {
    baseUrl: 'http://localhost:' + harvesterPort,
    harvester: {
        port: harvesterPort,
        options: {
            adapter: 'mongodb',
            connectionString: process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/test",
            db: process.env.MONGODB || 'test',
            inflect: true,
            oplogConnectionString: (process.env.OPLOG_MONGODB_URL || "mongodb://127.0.0.1:27017/local") + '?slaveOk=true',
        }
    }
};
