var Joi = require('joi');
var $http = require('http-as-promised');
var should = require('should');
var _ = require('lodash');
var Promise = require("bluebird");
var request = require('supertest');
var harvester = require('../lib/harvester');

// todo we need a better strategy to stand up test harvesterjs instances
// listening on hard coded free ports and duplicating harvesterjs options is not very robust and DRY

var harvesterOptions = {
    adapter: 'mongodb',
    connectionString: 'mongodb://127.0.0.1:27017/testDB',
    db: 'testDB',
    inflect: true,
    oplogConnectionString: 'mongodb://127.0.0.1:27017/local?slaveOk=true'
};

describe('remote link', function () {

    describe('given 2 resources : \'posts\', \'people\' ; defined on distinct harvesterjs servers ' +
        'and posts has a remote link \'author\' defined to people', function () {

        var app1Port = 8011;
        var app2Port = 8012;
        var app1BaseUrl = 'http://localhost:' + app1Port;
        var app2BaseUrl = 'http://localhost:' + app2Port;

        before(function () {

            var that = this;
            that.timeout(100000);


            that.harvesterApp1 =
                harvester(harvesterOptions)
                    .resource('post', {
                        title: Joi.string(),
                        links: {
                            author: {ref: 'person', baseUri: 'http://localhost:' + app2Port},
                            comments: ['comment'],
                            topic: 'topic'
                        }
                    })
                    .resource('topic', {
                        name: Joi.string()
                    })
                    .resource('comment', {
                        body: Joi.string()
                    })
                    .listen(app1Port);

            that.harvesterApp2 =
                harvester(harvesterOptions)
                    .resource('person', {
                        firstName: Joi.string(),
                        lastName: Joi.string(),
                        links:{
                            country: 'country'
                        }
                    })
                    .resource('country', {
                        code: Joi.string()
                    })
                    .listen(app2Port);

            // todo move into utility class or upgrade to latest version of mongoose which returns a promise
            function removeCollection(model) {
                return new Promise(function (resolve, reject) {
                    model.collection.remove(function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            }

            return removeCollection(that.harvesterApp1.adapter.model('post'))
                .then(function () {
                    return removeCollection(that.harvesterApp2.adapter.model('person'))
                })
                .then(function () {
                    // todo come up with a consistent pattern for seeding
                    // as far as I can see we are mixing supertest, chai http and http-as-promised
                    return $http({
                        uri: app2BaseUrl + '/countries',
                        method: 'POST',
                        json: {countries: [{code: 'US'}]}
                    })
                })
                .spread(function (res, body) {
                    that.countryId = body.countries[0].id;
                    return $http({
                        uri: app2BaseUrl + '/people',
                        method: 'POST',
                        json: {people: [{firstName: 'Tony', lastName: 'Maley', links: {country: that.countryId}}]}
                    })
                })
                .spread(function (res, body) {
                    that.authorId = body.people[0].id;
                    return $http({
                        uri: app1BaseUrl + '/posts',
                        method: 'POST',
                        json: {posts: [{title: 'Nodejs rules !', links: {author: that.authorId}}]}
                    });
                })
                .spread(function (res, body) {
                    that.postId = body.posts[0].id;
                    return $http({
                        uri: app1BaseUrl + '/comments',
                        method: 'POST',
                        json: {comments: [{body: 'That\'s crazy talk, Ruby is the best !'}]}
                    });
                })
                .spread(function (res, body) {
                    that.commentId = body.comments[0].id;
                    return $http({
                        uri: app1BaseUrl + '/posts/' + that.postId,
                        method: 'PATCH',
                        json: [{op: 'replace', path: 'posts/0/links/comments', value: [that.commentId]}]
                    });
                });
        });

        describe('fetch posts and include author', function () {
            it('should respond with a compound document with people included', function (done) {
                var that = this;
                // todo come up with a consistent pattern for assertions
                request(app1BaseUrl)
                    .get('/posts?include=author')
                    .expect(200)
                    .end(function (error, response) {
                        var body = response.body;
                        _.pluck(body.linked.people, 'id').should.eql([that.authorId]);
                        done();
                    });
            });
        });

        describe('fetch posts include author.country', function () {
            it('should respond with a compound document with people and countries included', function (done) {
                var that = this;
                // todo come up with a consistent pattern for assertions
                request(app1BaseUrl)
                    .get('/posts?include=author.country')
                    .expect(200)
                    .end(function (error, response) {
                        var body = response.body;
                        _.pluck(body.linked.people, 'id').should.eql([that.authorId]);
                        _.pluck(body.linked.countries, 'id').should.eql([that.countryId]);
                        done();
                    });
            });
        });

        describe('fetch posts include topic, author, author.country and comments', function () {
            it('should respond with a compound document with people, countries and comments included', function (done) {
                var that = this;
                // todo come up with a consistent pattern for assertions
                request(app1BaseUrl)
                    .get('/posts?include=topic,comments,author,author.country')
                    .expect(200)
                    .end(function (error, response) {
                        var body = response.body;
                        _.pluck(body.linked.people, 'id').should.eql([that.authorId]);
                        _.pluck(body.linked.countries, 'id').should.eql([that.countryId]);
                        _.pluck(body.linked.comments, 'id').should.eql([that.commentId]);
                        done();
                    });
            });
        });

    });


});
