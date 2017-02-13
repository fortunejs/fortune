var should = require('should');
var _ = require('lodash');
var lodash = require('lodash');
var request = require('supertest');

module.exports = function(options){
  describe('4xx codes for nonexistent, non-destructively deleted and not permitted docs', function(){
    var app, baseUrl, ids, adapter;
    beforeEach(function(){
      app = options.app;
      adapter = app.adapter;
      baseUrl = options.baseUrl;
      ids = options.ids;
    });

    it('should return 200 for an existing doc', function(done){
      request(baseUrl).get('/people/' + ids.people[0])
        .expect(200)
        .end(function(err){
          should.not.exist(err);
          done();
        });
    });

    it('should return 404 for an non-existing doc', function(done){
      request(baseUrl).get('/people/0')
        .expect(404)
        .end(function(err){
          should.not.exist(err);
          done();
        });
    });

    it('should return 403 for an non-permitted doc', function(done){
      request(baseUrl).get('/people/' + ids.people[0])
        .set('set-fortune-extension', 'born-in-1995')
        .expect(403)
        .end(function(err){
          should.not.exist(err);
          done();
        });
    });

    it('should return 410 for a non-destructively deleted doc', function(done){
      request(baseUrl).del('/people/' + ids.people[0])
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people[0])
            .expect(410)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it('should return 404 for a destructively deleted doc', function(done){
      request(baseUrl).del('/people/' + ids.people[0] + '?destroy=1')
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people[0])
            .expect(404)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it('should return 403 for a non-permitted non-destructively deleted doc', function(done){
      request(baseUrl).del('/people/' + ids.people[0])
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people[0])
            .set('set-fortune-extension', 'born-in-1995')
            .expect(403)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it('should return 200 for a non-restricted list of docs', function(done){
      request(baseUrl).get('/people/' + ids.people.join(','))
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.length.should.equal(ids.people.length);
          done();
        });
    });

    it('should return 200 for an incomplete, but non-empty list of docs', function(done){
      request(baseUrl).get('/people/fake1,' + ids.people.join(','))
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          var body = JSON.parse(res.text);
          body.people.length.should.be.greaterThan(0);
          body.people.length.should.equal(ids.people.length);
          done();
        });
    });

    it('should return 404 for an empty list of docs (the first doc in the list does not exist)', function(done){
      request(baseUrl).del('/people/' + ids.people[0] + '?destroy=1')
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people.join(','))
            .set('set-fortune-extension', 'dilbert')
            .expect(404)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it('should return 410 for an empty list of docs (the first doc in the list is non-destructively deleted)', function(done){
      request(baseUrl).del('/people/' + ids.people[0])
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people.join(','))
            .set('set-fortune-extension', 'dilbert')
            .expect(410)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });

    it('should return 403 for an empty list of docs (access to the first doc in the list is prohibited)', function(done){
      request(baseUrl).get('/people/' + ids.people.join(','))
        .set('set-fortune-extension', 'nobody')
        .expect(403)
        .end(function(err){
          should.not.exist(err);
          done();
        });
    });

    it('should return 403 for an empty list of docs (access to the first doc in the list is prohibited and it is non-destructively deleted)', function(done){
      request(baseUrl).del('/people/' + ids.people[0])
        .end(function(err){
          should.not.exist(err);
          request(baseUrl).get('/people/' + ids.people.join(','))
            .set('set-fortune-extension', 'nobody')
            .expect(403)
            .end(function(err){
              should.not.exist(err);
              done();
            });
        });
    });
  });
};