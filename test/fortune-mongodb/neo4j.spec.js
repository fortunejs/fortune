var should = require('should');

var adapter = require('../../lib/adapters/neo4j');

var _ = require('lodash');

//TODO : I think these tests would be better written as pure unit tests, asserting that the correct call was made to a stub of the
//neo4j adapter... No need for the "runner" then
module.exports = function(options){
  describe('Neo4j adapter', function(){
    var ids;

    beforeEach(function(){
      ids = options.ids;
    });

    xdescribe('Creation', function(){
      it('should be able to create document with provided id', function(done){
        var doc = {
          id: '123456789012345678901234'
        };
        adapter.create('pet', doc).then(function(){
          var model = adapter.model('pet');
          model.findOne({_id: '123456789012345678901234'}).exec(function(err, doc){
            should.not.exist(err);
            should.exist(doc);
            done();
          });
        });
      });
      it('should be able to cast provided id to proper type', function(done){
        var doc = {
          id: '123456789012345678901234'
        };
        adapter.create('person', doc).then(function(){
          var model = adapter.model('person');
          model.findOne({email: '123456789012345678901234'}).exec(function(err, doc){
            should.not.exist(err);
            should.exist(doc);
            done();
          });
        });
      });
      it("should upsert where the appropriate upsert keys are specified", function(done) {
        var doc = {
          id: '123456789012345678901234',
          upsertTest : "foo"
        };

        var model = adapter.model("person");
        model.schema.upsertKeys = ["upsertTest"];

        var response = null,
          upsertVal  = false,
          origUpsert = adapter._shouldUpsert;

        adapter._shouldUpsert = function() {
          return response = origUpsert.apply(this, arguments);
        };

        adapter.create("person", doc).then(function() {
          should.exist(response);
          (response.status).should.equal(true);
          (response.opts.upsert).should.equal(true);

          model.findOne({email: '123456789012345678901234'}).exec(function(err, doc){
            should.not.exist(err);
            should.exist(doc);

            adapter._shouldUpsert = origUpsert;
            done();
          });
        });
      });
      it("should not upsert where the appropriate upsert keys are not specified", function(done) {
        var doc = {
          id: '123456789012345678901234',
          upsertTestYYY : "foo"
        };

        var model = adapter.model("person");
        model.schema.upsertKeys = ["upsertTest"];

        var response = null,
          upsertVal  = false,
          origUpsert = adapter._shouldUpsert;

        adapter._shouldUpsert = function() {
          return response = origUpsert.apply(this, arguments);
        };

        adapter.create("person", doc).then(function() {
          should.exist(response);
          (response.status).should.equal(false);
          (response.opts.upsert).should.equal(false);

          model.findOne({email: '123456789012345678901234'}).exec(function(err, doc){
            should.not.exist(err);
            should.exist(doc);

            adapter._shouldUpsert = origUpsert;
            done();
          });
        });
      });
    });

    xdescribe('Relationships', function(){
      describe('synchronizing many-to-many', function(){
        it('should keep in sync many-to-many relationship', function(){
          return adapter.update('person', ids.people[0], {$pushAll: {houses: [ids.houses[0]]}})
            .then(function(created){
              (created.links.houses[0].toString()).should.equal(ids.houses[0].toString());
            }).then(function(){
              return adapter.find('house', {id: ids.houses[0]});
            }).then(function(found){
              (found.links.owners[0]).should.equal(ids.people[0]);
            });
        });
        it('should sync correctly when many docs have reference', function(){
          var upd =  {
            $pushAll: {
              houses: ids.houses
            }
          };
          return adapter.update('person', ids.people[0], upd)

            //Prove successful initial association
            .then(function(updated){
              (updated.links.houses.length).should.eql(4);
              var refHouses = [];
              updated.links.houses.forEach(function(id){
                refHouses.push(id.toString());
              });
              return adapter.findMany('house', {owners: ids.people[0]});
            })

            .then(function(found){
              (found.length).should.equal(4);
              //Do some other updates to mix docs in Mongo
              return adapter.update('person', ids.people[1], {$push: {houses: ids.houses[0]}});
            })

            //Kick him out the house
            .then(function(){
              return adapter.update('person', ids.people[0], {$pull: {houses: ids.houses[0]}});
            })

            //Then assert related docs sync
            .then(function(pulled){
              //Now there should be only three houses that person[0] owns
              (pulled.links.houses.length).should.eql(3);
              return adapter.findMany('house', {owners: ids.people[0]})
            })
            .then(function(found){
              (found.length).should.eql(3);
              //Assert there's no house[0] in found docs
              found.forEach(function(item){
                (item.id.toString()).should.not.equal(ids.houses[0].toString());
              });
            });
        });
      });
      describe('sync path selection', function(){
        it('should have a method to identify changed paths', function(){
          (adapter._getModifiedRefs).should.be.a.Function;
          var update = {
            refPath: 'some new value',
            $push: {
              manyRefOne: 'one'
            },
            $pull: {
              manyRefTwo: 'two'
            },
            $addToSet: {
              manyRefThree: 'three'
            },
            $unset: {
              'nested.ref': 'nested'
            }
          };
          var modifiedPaths = adapter._getModifiedRefs(update);
          (modifiedPaths.indexOf('refPath')).should.not.equal(-1);
          (modifiedPaths.indexOf('manyRefOne')).should.not.equal(-1);
          (modifiedPaths.indexOf('manyRefTwo')).should.not.equal(-1);
          (modifiedPaths.indexOf('manyRefThree')).should.not.equal(-1);
          (modifiedPaths.indexOf('nested.ref')).should.not.equal(-1);
        });
        it('should not run updates on related documents which binding path were not modified during the update', function(){
          var oto = adapter._updateOneToOne;
          var otm = adapter._updateOneToMany;
          var mtm = adapter._updateManyToMany;
          var mto = adapter._updateManyToOne;
          var mockCalled = false;
          adapter._updateOneToOne = function(){
            mockCalled = true;
          };
          adapter._updateOneToMany = function(){
            mockCalled = true;
          };
          adapter._updateManyToMany = function(){
            mockCalled = true;
          };
          adapter._updateManyToOne = function(){
            mockCalled = true;
          };
          return adapter.update('person', ids.people[0], {$set: {name: 'Filbert'}}).then(function(){
            mockCalled.should.equal(false);
            adapter._updateOneToOne = oto;
            adapter._updateOneToMany = otm;
            adapter._updateManyToMany = mtm;
            adapter._updateManyToOne = mto;
          });
        });
        it('should update references if ref path was changed', function(){
          var oto = adapter._updateOneToOne;
          var mockCalled = false;
          adapter._updateOneToOne = function(){
            mockCalled = true;
            return oto.apply(null, arguments);
          };
          return adapter.update('person', ids.people[0], {$set: {soulmate: ids.people[1]}}).then(function(){
            mockCalled.should.equal(true);
            adapter._updateOneToOne = oto;
          });
        });
      });
    });

    describe('Select', function(){
      xdescribe('count', function(){
        it('should provide interface for counting resources', function(){
          return adapter.count('person').then(function(docs){
            should.exist(docs);
            docs.should.eql(4);
          });
        });
        it("should count results falling under query", function() {
          return adapter.count('person', { birthday: { $gte: new Date(1995, 0, 1)}}).then(function(docs){
            should.exist(docs);
            docs.should.eql(3);
          });
        });
        it("should ignore not valid queries", function() {
          return adapter.count('person', 'some').then(function(docs){
            should.exist(docs);
            docs.should.eql(4);
          });
        });
      });

      describe('findMany', function(){
        it('should provide interface for selecting fields to return', function(){
          var projection = {
            select: ['name']
          };
          return adapter.findMany('person', {}, projection).then(function(docs){
            should.exist(docs);
          });
        });
        xit('should select specified fields for a collection', function(){
          var projection = {
            select: ['name', 'appearances', 'pets']
          };
          return adapter.findMany('person', {}, projection).then(function(docs){
            (Object.keys(docs[0]).length).should.equal(3);
            should.exist(docs[0].name);
            should.exist(docs[0].appearances);
            should.exist(docs[0].id);
          });
        });
        xit('should return all existing fields when no select is specified', function(){
          return adapter.findMany('person').then(function(docs){
            //hooks add their black magic here.
            //See what you have in fixtures + what beforeWrite hooks assign in addiction
            var keys = Object.keys(docs[0]).length;
            (keys).should.equal(9);
          });
        });
        xit('should not affect business id selection', function(){
          return adapter.findMany('person', [ids.people[0]], {select: ['name']}).then(function(docs){
            docs[0].id.should.equal(ids.people[0]);
            should.not.exist(docs[0].email);
          });
        });
        xit('should apply be able to apply defaults for query and projection', function(){
          return adapter.findMany('person');
        });
        xit('should be able to work with numerical limits', function(){
          return adapter.findMany('person', 1).then(function(docs){
            docs.length.should.equal(1);
          });
        });
      });
      xdescribe('find', function(){
        beforeEach(function(done){
          adapter.update('person', ids.people[0], {$push: {pets: ids.pets[0]}})
            .then(function(){
              return adapter.update('person', ids.people[0], {$set: {soulmate: ids.people[1]}})
            })
            .then(function(){
              return adapter.update('person', ids.people[0], {$push: {houses: ids.houses[0]}})
            })
            .then(function(){
              done();
            });
        });
        it('should provide interface for selecting fields to return', function(done){
          var projection = {
            select: ['name', 'pets', 'soulmate']
          };
          (function(){
            adapter.find('person', {email: ids.people[0]}, projection)
              .then(function(docs){
                should.exist(docs);
                done();
              });
          }).should.not.throw();
        });
        it('should select specified fields for a single document', function(done){
          var projection = {
            select: ['name', 'soulmate', 'pets', 'houses']
          };
          adapter.find('person', ids.people[0], projection)
            .then(function(doc){
              (Object.keys(doc).length).should.equal(3);
              (Object.keys(doc.links).length).should.equal(3);
              should.exist(doc.name);
              should.exist(doc.links.pets);
              should.exist(doc.links.soulmate);
              should.exist(doc.links.houses);
              done();
            });
        });
        it('should return all existing fields when no select is specified', function(done){
          adapter.find('person', ids.people[0])
            .then(function(doc){
              //hooks add their black magic here.
              //See what you have in fixtures + what beforeWrite hooks assign in addiction
              //+ soulmate from before each
              (Object.keys(doc).length).should.equal(10);
              done();
            });
        });
        it('should not affect business id selection', function(done){
          adapter.find('person', ids.people[0], {select: ['name', 'soulmate', 'pets', 'houses']})
            .then(function(doc){
              (doc.id).should.equal(ids.people[0]);
              (doc.links.soulmate).should.equal(ids.people[1]);
              (doc.links.houses[0].toString()).should.equal(ids.houses[0]);
              (doc.links.pets[0].toString()).should.equal(ids.pets[0]);
              should.not.exist(doc.email);
              done();
            });
        });
        it('should apply be able to apply defaults for query and projection', function(done){
          (function(){
            adapter.find('person', ids.people[0]);
          }).should.not.throw();
          done();
        });
      });
    });
    
    xdescribe('Filtering', function(){
      it('should be able to filter date by exact value', function(done){
        adapter.findMany('person', {birthday: '2000-01-01'})
          .then(function(docs){
            (docs.length).should.equal(1);
            (docs[0].name).should.equal('Robert');
            done();
          });
      });
      it('should be able to filter date range: exclusive', function(done){
        var query = {
          birthday: {
            lt: '2000-02-02',
            gt: '1990-01-01'
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(3);
            done();
          });
      });
      it('should be able to filter date range: inclusive', function(done){
        var query = {
          birthday: {
            gte: '1995-01-01',
            lte: '2000-01-01'
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(3);
            done();
          });
      });
      it('should be able to filter number range: exclusive', function(done){
        var query = {
          appearances: {
            gt: 1934,
            lt: 4000
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(1);
            done();
          });
      });
      it('should be able to filter number range: inclusive', function(done){
        var query = {
          appearances: {
            gte: 1934,
            lte: 3457
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(2);
            done();
          });
      });

      it("should be tolerant to $in:undefined queries", function(done){
        var query = { '$in': undefined  };

        adapter.findMany("person", query).then(function(){ done(); });
      });

      it("should be tolerant to $in:null queries", function(done){
        var query = { '$in': null  };

        adapter.findMany("person", query).then(function(){ done(); });
      });

      it('should be able to run regex query with default options', function(){
        var queryLowercase = {
          email: {
            regex: 'bert@'
          }
        };
        var queryUppercase = {
          email: {
            regex: 'Bert@'
          }
        };
        return adapter.findMany('person', queryLowercase).then(function(docs){
          docs.length.should.equal(2);
        }).then(function(){
          return adapter.findMany('person',queryUppercase).then(function(docs){
            (docs.length).should.equal(0);
          });
        });
      });
      it('should be possible to specify custom options', function(done){
        var query = {
          name: {
            regex: 'WALLY',
            options: 'i'
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(1);
            (docs[0].name).should.equal('Wally');
            done();
          });
      });
      it('should treat empty regex as find all', function(done){
        var query = {
          email: {
            regex: ''
          }
        };
        adapter.findMany('person', query)
          .then(function(docs){
            (docs.length).should.equal(4);
            done();
          });
      });
      it('should deeply parse nested $and, $or, or, and queries', function(done){
        var query = {
          $or: [{
            or: [{
              $and: [{
                and: [{
                  name: {
                    regex: 'WALLY',
                    options: 'i'
                  }
                }]
              }]
            }]
          }]
        };
        adapter.findMany('person', query)
          .then(function(docs){
            docs.length.should.equal(1);
            docs[0].name.should.equal('Wally');
            done();
          });
      });
    });
  });

};
