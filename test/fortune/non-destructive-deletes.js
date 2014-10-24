var should = require('should');
var lodash = require('lodash');
var request = require('supertest');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

module.exports = function(options){
  describe.skip('non-destructive deletes', function(){
    var app, baseUrl, ids, adapter;
    beforeEach(function(){
      app = options.app;
      adapter = app.adapter;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });
    it('should mark item with deletedAt', function(done){
      request(baseUrl).del('/people/' + ids.people[0])
        .end(function(err){
          should.not.exist(err);
          adapter.model('person').findOne({email: ids.people[0]}, function(err, doc){
            should.not.exist(err);
            doc.deletedAt.should.be.ok;
            done();
          });
        });
    });
    it('related resources should no longer reference deleted resource', function(done){
      request(baseUrl).patch('/people/' + ids.people[0])
        .set('content-type', 'application/json')
        .send(JSON.stringify([
          {op: 'replace', path: '/people/0/links/addresses', value: [ids.addresses[0], ids.addresses[1]]}
        ]))
        .expect(200)
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).del('/people/' + ids.people[0]).end(function(err) {
            should.not.exist(err);
            request(baseUrl).get('/addresses/' + [ids.addresses[0], ids.addresses[1]].join(','))
              .expect(200)
              .end(function (err, res) {
                should.not.exist(err);
                var body = JSON.parse(res.text);
                body.addresses.forEach(function (address) {
                  should.not.exist(address.links);
                });
                done();
              });
            });
        });
    });
    it('should keep existing links to foreign resources nested to _links', function(done){
      request(baseUrl).patch('/people/' + ids.people[0])
        .set('content-type', 'application/json')
        .send(JSON.stringify([
          {op: 'replace', path: '/people/0/links/addresses', value: [ids.addresses[0], ids.addresses[1]]},
          {op: 'replace', path: '/people/0/links/soulmate', value: ids.people[1]}
        ]))
        .expect(200)
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).del('/people/' + ids.people[0]).end(function(err) {
            should.not.exist(err);
            adapter.model('person').findOne({email: ids.people[0]}, function (err, doc) {
              should.not.exist(err);
              doc._links.addresses.map(function(o){return o.toString()}).should.eql([ids.addresses[0], ids.addresses[1]]);
              doc._links.soulmate.toString().should.equal(ids.people[1]);
              done();
            });
          });
        });
    });
    it('should be able to delete resource destructively', function(done){
      request(baseUrl).del('/people/' + ids.people[0] + '?destroy=1')
        .end(function(err){
          should.not.exist(err);
          adapter.model('person').findOne({email: ids.people[0]}, function(err, doc){
            should.not.exist(err);
            should.not.exist(doc);
            done();
          });
        });
    });
    it('should return 404 for subsequent operations with deleted resource', function(done){
      request(baseUrl).del('/people/' + ids.people[0]).end(function(err){
        should.not.exist(err);
        RSVP.all([
          new Promise(function(resolve){
            request(baseUrl).get('/people/' + ids.people[0])
              .expect(404)
              .end(function(err){
                should.not.exist(err);
                resolve();
              });
          }),
          new Promise(function(resolve){
            request(baseUrl).patch('/people/' + ids.people[0])
              .set('content-type', 'application/json')
              .send(JSON.stringify([
                {op: 'replace', path: '/people/0/name', value: 'zombie'}
              ]))
              .expect(404)
              .end(function(err){
                should.not.exist(err);
                resolve();
              });
          }),
          new Promise(function(resolve){
            request(baseUrl).del('/people/' + ids.people[0])
              .expect(404)
              .end(function(err){
                should.not.exist(err);
                resolve();
              });
          })
        ]).then(function(){
          done();
        });
      });
    });
    it('should allow PUT request replacing old document with new one', function(done){
      request(baseUrl).del('/people/' + ids.people[0]).end(function(err){
        should.not.exist(err);
        request(baseUrl).put('/people/' + ids.people[0])
          .set('content-type', 'application/json')
          .send(JSON.stringify({
            people: [{name: 'Replaced', email: ids.people[0]}]
          }))
          .end(function(err){
            should.not.exist(err);
            adapter.model('people').findOne({email: ids.people[0]}, function(err, doc){
              should.not.exist(err);
              doc.name.should.equal('Replaced');
              doc.email.should.equal(ids.people[0]);
              Object.keys(doc).length.should.equal(2);
              done();
            });
          });
      });
    });
  });
};