var should = require('should');
var _ = require('lodash');
var lodash = require('lodash');
var request = require('supertest');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

module.exports = function(options){
  describe('non-destructive deletes', function(){
    var app, baseUrl, ids, adapter;
    beforeEach(function(){
      app = options.app;
      adapter = app.adapter;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });
    it('should not reveal empty _links', function(done){
      request(baseUrl).get('/people')
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.forEach(function(p){
            should.not.exist(p._links);
          });
          done();
        })
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
    it('should mark collection as deleted for collection route', function(done){
      request(baseUrl).del('/people').expect(204).end(function(err){
        should.not.exist(err);
        adapter.model('person').find({}, function(err, docs){
          should.not.exist(err);
          docs.length.should.be.greaterThan(0);
          done()
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
    it('should not delete resource if beforeHook returns false', function(done){
      request(baseUrl).del('/people/' + ids.people[0] + '?failbeforeAll=1')
        .expect(321)
        .end(function(err){
          should.not.exist(err);
          adapter.model('person').findOne({email: ids.people[0]}, function(err, doc){
            should.not.exist(err);
            should.exist(doc);
            should.not.exist(doc.deletedAt);
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
          }),
          new Promise(function(resolve){
            request(baseUrl).get('/people')
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                body.people.forEach(function(person){
                  person.id.should.not.equal(ids.people[0]);
                });
                resolve();
              });
          })
        ]).then(function(){
          done();
        });
      });
    });
    it('should return deleted resource if it is requested explicitly', function(done){
      request(baseUrl).del('/people/' + ids.people[0]).end(function(err) {
        should.not.exist(err);
        request(baseUrl).get('/people?includeDeleted=true').end(function(err, res){
          var body = JSON.parse(res.text);
          var del = _.find(body.people, function(p){return p.id === ids.people[0]});
          should.exist(del);
          request(baseUrl).get('/people/' + ids.people[0] + '?includeDeleted=true').end(function(err, res){
            var body = JSON.parse(res.text);
            should.exist(body.people[0]);
            done();
          });
        });
      });
    });

    it('should not return deleted item with /:resource/:id/:linked response', function(done){
      request(baseUrl).patch('/people/' + ids.people[0]).set('content-type', 'application/json')
        .send(JSON.stringify([{op: 'replace', path: '/people/0/addresses', value: [ids.addresses[0], ids.addresses[1]]}]))
        .end(function(err, res){
          should.not.exist(err);
          request(baseUrl).del('/addresses/' + ids.addresses[0]).end(function(){
            request(baseUrl).get('/people/' + ids.people[0] + '/addresses')
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                var body = JSON.parse(res.text);
                body.addresses.length.should.equal(1);
                done();
              });
          });
        });
    });
    it.skip('should allow PUT request replacing old document with new one', function(done){
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
              should.not.exist(doc.deletedAt);
              Object.keys(doc).length.should.equal(2);
              done();
            });
          });
      });
    });
  });
};