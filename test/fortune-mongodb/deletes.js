var should = require('should');

var adapter = require('../../lib/adapters/mongodb');

var RSVP = require('rsvp');
var Promise = RSVP.Promise;
var _ = require('lodash');

module.exports = function(options){
  describe.skip('non-destructive deletion', function(){
    var ids;
    beforeEach(function(){
      ids = options.ids;
    });
    it('should mark item as deleted', function(done){
      adapter.markDeleted('person', ids.people[0]).then(function(){
        return adapter.find('person', ids.people[0]).then(function(doc){
          should.exist(doc);
          should.exist(doc.deletedAt);
          should.exist(doc._links);
          done();
        });
      });
    });
    it('should keep current links', function(done){
      adapter.update('person', ids.people[0], {$set: {addresses: [ids.addresses[0]]}})
        .then(function(){
          return adapter.markDeleted('person', ids.people[0])
        })
        .then(function(){
          return adapter.find('person', ids.people[0])
        }).then(function(doc){
          should.exist(doc);
          should.exist(doc._links);
          doc._links.addresses[0].toString().should.equal(ids.addresses[0]);
          done();
        });
    });
    it('should disassociate real links', function(done){
      adapter.update('person', ids.people[0], {$set: {addresses: [ids.addresses[0]]}})
        .then(function(){
          return adapter.markDeleted('person', ids.people[0])
        })
        .then(function(){
          return adapter.find('address', ids.addresses[0]);
        }).then(function(doc){
          should.exist(doc);
          should.not.exist(doc.owner);
          should.not.exist(doc.links);
          done();
        });
    });
  });
};