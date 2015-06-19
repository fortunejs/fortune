var should = require('should');
var _ = require('lodash');
var RSVP = require('rsvp');
var request = require('supertest');
var Promise = RSVP.Promise;

var seeder = require('./seeder.js');


describe("includes", function () {

    var config, ids;

    function setupLinks(_ids) {
        ids = _ids;

        function link(url, path, value) {
            return new Promise(function (resolve) {
                var data = [
                    {
                        op: 'replace',
                        path: path,
                        value: value
                    }
                ];
                request(config.baseUrl).patch(url).set('Content-Type', 'application/json').send(JSON.stringify(data)).end(function (err) {
                    should.not.exist(err);
                    setTimeout(resolve, 100);//sometimes tests fail if resolve is called immediately, probably mongo has problems indexing concurrently
                });
            });
        }

        return RSVP.all([
            link('/people/' + ids.people[0], '/people/0/soulmate', ids.people[1]), //TODO: harvester should take care about this on its own
            link('/people/' + ids.people[1], '/people/0/soulmate', ids.people[0]),

            link('/people/' + ids.people[0], '/people/0/lovers', [ids.people[1]])
        ])
    }

    beforeEach(function () {
        config = this.config;
        return seeder(this.harvesterApp).dropCollectionsAndSeed('people', 'pets').then(setupLinks);
    });

    describe("many to many", function () {
        it('should include referenced lovers when querying people', function (done) {
            request(config.baseUrl).get('/people?include=lovers').expect(200).end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.linked).should.be.an.Object;
                (body.linked.people).should.be.an.Array;
                (body.linked.people.length).should.be.above(0);
                done();
            });
        });
    });
    describe("one to one", function () {
        it('should include soulmate when querying people', function (done) {
            request(config.baseUrl).get('/people?include=soulmate').expect(200).end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.linked).should.be.an.Object;
                (body.linked.people).should.be.an.Array;
                (body.linked.people.length).should.equal(2);
                done();
            });
        });
    });
    //Todo: add test for "," support.

    describe("repeated entities", function () {
        it.skip('should deduplicate included soulmate & lovers when querying people', function (done) {
            request(config.baseUrl).get('/people?include=soulmate,lovers').expect(200).end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                (body.linked).should.be.an.Object;
                (body.linked.people).should.be.an.Array;
                var log = {};
                _.each(body.linked.people, function (person) {
                    should.not.exist(log[person.id]);
                    log[person.id] = person;
                });
                done();
            });
        });
    });

    /*
     it('should include uniq documents', function(done){
     request(config.baseUrl).get('/people/' + idsHolder.ids.people[1] + '?include=houses,estate')
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     (body.linked.houses.length).should.equal(2);
     done();
     });
     });
     describe('include external resources', function(){
     beforeEach(function(done){
     //Create external bindings;
     new Promise(function(resolve){
     request(config.baseUrl).patch('/cars/' + idsHolder.ids.cars[0])
     .set('content-type', 'application/json')
     .send(JSON.stringify([
     {op: 'replace', path: '/cars/0/MOT', value: 'motOne'},
     {op: 'replace', path: '/cats/0/links/owner', value: idsHolder.ids.people[0]}
     ]))
     .expect(200)
     .end(function(err){
     should.not.exist(err);
     resolve();
     });
     }).then(function(){
     return new Promise(function(resolve){
     request(config.baseUrl).patch('/cars/' + idsHolder.ids.cars[1])
     .set('content-type', 'application/json')
     .send(JSON.stringify([
     {op: 'replace', path: '/cars/0/MOT', value: 'motTwo'},
     {op: 'replace', path: '/cars/0/links/owner', value: idsHolder.ids.people[1]}
     ]))
     .expect(200)
     .end(function(err){
     should.not.exist(err);
     resolve();
     });
     });
     }).then(function(){
     request(config.baseUrl).patch('/people/' + idsHolder.ids.people[0])
     .set('content-type', 'application/json')
     .send(JSON.stringify([
     {op: 'replace', path: '/people/0/links/soulmate', value: idsHolder.ids.people[1]}
     ]))
     .expect(200)
     .end(function(err){
     should.not.exist(err);
     done();
     });
     });
     });
     it('should mark external include as external', function(done){
     request(config.baseUrl).get('/cars?include=MOT')
     .expect(200)
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     body.linked.services.should.equal('external');
     done();
     });
     });
     it('should mark external include when its two levels deep', function(done){
     request(config.baseUrl).get('/people?include=cars.MOT')
     .expect(200)
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     body.linked.services.should.equal('external');
     done();
     });
     });
     it('should mark external include when its requested twice', function(done){
     request(config.baseUrl).get('/people?include=soulmate.cars.MOT,cars.MOT')
     .expect(200)
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     body.linked.services.should.equal('external');
     done();
     });
     });
     it('should mark external include when resource is requested by id', function(done){
     request(config.baseUrl).get('/cars/' + idsHolder.ids.cars[0] + '?include=MOT')
     .expect(200)
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     body.linked.services.should.equal('external');
     done();
     });
     });
     it('should mark external include when its nested and resource is requested by id', function(done){
     request(config.baseUrl).get('/people/' + idsHolder.ids.people[0] + '?include=cars.MOT,soulmate.cars.MOT')
     .expect(200)
     .end(function(err, res){
     should.not.exist(err);
     var body = JSON.parse(res.text);
     body.linked.services.should.equal('external');
     done();
     });
     });
     });*/
});
