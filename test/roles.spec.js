var Promise = require('bluebird');
var request = require('supertest');
var Joi = require('joi');

var harvester = require('../lib/harvester');
var seeder = require('./seeder.js');
var config = require('./config.js');

describe('Roles', function () {

    var harvesterInstance;
    var harvesterPort = 8008;
    var harvesterSeedPort = 8009;
    var seedingHarvesterPort = harvesterPort + 1;
    var baseUrl = 'http://localhost:' + harvesterPort;
    var seedingBaseUrl = 'http://localhost:' + seedingHarvesterPort;
    var personId = '11111111-1111-1111-1111-111111111111';
    var userId = '22222222-2222-2222-2222-222222222222';
    var petId = '33333333-3333-3333-3333-333333333333';
    var authorizationStrategy;

    before(function () {
        harvesterInstance = harvester(config.harvester.options);
        var resourceSchema = {name: Joi.string()};
        harvesterInstance.resource('person', resourceSchema).roles('Admin');
        harvesterInstance.resource('pets', resourceSchema);
        harvesterInstance.resource('user', resourceSchema).roles('Admin', 'SuperAdmin');
        harvesterInstance.resource('user').getById().roles('Moderator');
        harvesterInstance.setAuthorizationStrategy(function () {
            return authorizationStrategy.apply(this, arguments);
        });
        harvesterInstance.listen(harvesterPort);

        /**
         * We need separate instance that does not have roles authorization, so that we can seed freely.
         */
        var seedingHarvesterInstance = harvester(config.harvester.options);
        seedingHarvesterInstance.resource('person', resourceSchema);
        seedingHarvesterInstance.resource('pets', resourceSchema);
        seedingHarvesterInstance.resource('user', resourceSchema);
        seedingHarvesterInstance.listen(harvesterSeedPort);
        this.seedingHarvesterInstance = seedingHarvesterInstance;
    });
    beforeEach(function () {
        var seederInstance = seeder(this.seedingHarvesterInstance, seedingBaseUrl);
        return seederInstance.dropCollections('people', 'pets', 'users').then(function () {
            return seederInstance.seedCustomFixture({people: [
                {id: personId, name: 'Jack'}
            ], users: [
                {id: userId, name: 'Jill'}
            ], pets: [
                {id: petId, name: 'JillDog'}
            ]});
        });
    });

    describe('having specific config, exportRoles', function () {
        it('should return proper roles descriptor', function () {
            var expectedDescriptor = {
                Admin: ['person.get', 'person.post', 'person.getById', 'person.putById', 'person.deleteById', 'person.patchById',
                        'person.getChangeEventsStreaming', 'user.get', 'user.post', 'user.putById', 'user.deleteById', 'user.patchById',
                        'user.getChangeEventsStreaming'],
                SuperAdmin: ['user.get', 'user.post', 'user.putById', 'user.deleteById', 'user.patchById', 'user.getChangeEventsStreaming'],
                Moderator: ['user.getById']
            };
            harvesterInstance.exportRoles().should.eql(expectedDescriptor);
        });
    });

    describe('being authed as Admin', function () {
        beforeEach(function () {
            authorizationStrategy = function (request, permission, rolesAllowed) {
                if (rolesAllowed.length === 0 || -1 < rolesAllowed.indexOf(('Admin'))) {
                    return Promise.resolve();
                } else {
                    return Promise.reject();
                }
            }
        });
        it('should be allowed to get people', function (done) {
            request(baseUrl)
                .get('/people')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post person', function (done) {
            request(baseUrl)
                .post('/people')
                .send({people: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should be allowed to get person by id', function (done) {
            request(baseUrl)
                .get('/people/' + personId)
                .expect(200)
                .end(done);
        });
        it('should be allowed to put person by id', function (done) {
            request(baseUrl)
                .put('/people/' + personId)
                .send({people: [
                    {name: 'Joseph'}
                ]})
                .expect(200)
                .end(done);
        });
        it('should be allowed to patch person by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/people/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/people/' + personId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for person', function () {
            throw new Error('Not implemented yet');
        });


        it('should be allowed to get users', function (done) {
            request(baseUrl)
                .get('/users')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post user', function (done) {
            request(baseUrl)
                .post('/users')
                .send({users: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should NOT be allowed to get user by id', function (done) {
            request(baseUrl)
                .get('/users/' + userId)
                .expect(403)
                .end(done);
        });
        it('should be allowed to put user by id', function (done) {
            request(baseUrl)
                .put('/users/' + userId)
                .send({users: [
                    {name: 'Joseph'}
                ]})
                .expect(200)
                .end(done);
        });
        it('should be allowed to patch user by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/users/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/users/' + userId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for user', function () {
            throw new Error('Not implemented yet');
        });


        it('should be allowed to get pets', function (done) {
            request(baseUrl)
                .get('/pets')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post pet', function (done) {
            request(baseUrl)
                .post('/pets')
                .send({pets: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should be allowed to get pet by id', function (done) {
            request(baseUrl)
                .get('/pets/' + petId)
                .expect(200)
                .end(done);
        });
        it('should be allowed to put pet by id', function (done) {
            request(baseUrl)
                .put('/pets/' + petId)
                .send({pets: [
                    {name: 'Joseph'}
                ]})
                .expect(200).
                end(done);
        });
        it('should be allowed to patch pet by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/pets/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/pets/' + petId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for pet', function () {
            throw new Error('Not implemented yet');
        });
    });

    describe('being authed as SuperAdmin', function () {
        beforeEach(function () {
            authorizationStrategy = function (request, permission, rolesAllowed) {
                if (rolesAllowed.length === 0 || -1 < rolesAllowed.indexOf(('SuperAdmin'))) {
                    return Promise.resolve();
                } else {
                    return Promise.reject();
                }
            }
        });
        it('should NOT be allowed to get people', function (done) {
            request(baseUrl)
                .get('/people')
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to post person', function (done) {
            request(baseUrl)
                .post('/people')
                .send({people: [
                    {name: 'Steve'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to get person by id', function (done) {
            request(baseUrl)
                .get('/people/' + personId)
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to put person by id', function (done) {
            request(baseUrl)
                .put('/people/' + personId)
                .send({people: [
                    {name: 'Joseph'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to patch person by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/people/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/people/' + personId)
                .send(patch)
                .expect(403)
                .end(done);
        });
        it.skip('should NOT be allowed to getChangeEventsStreaming for person', function () {
            throw new Error('Not implemented yet');
        });


        it('should be allowed to get users', function (done) {
            request(baseUrl)
                .get('/users')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post user', function (done) {
            request(baseUrl)
                .post('/users')
                .send({users: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should NOT be allowed to get user by id', function (done) {
            request(baseUrl)
                .get('/users/' + userId)
                .expect(403)
                .end(done);
        });
        it('should be allowed to put user by id', function (done) {
            request(baseUrl)
                .put('/users/' + userId)
                .send({users: [
                    {name: 'Joseph'}
                ]})
                .expect(200)
                .end(done);
        });
        it('should be allowed to patch user by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/users/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/users/' + userId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for user', function () {
            throw new Error('Not implemented yet');
        });


        it('should be allowed to get pets', function (done) {
            request(baseUrl)
                .get('/pets')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post pet', function (done) {
            request(baseUrl)
                .post('/pets')
                .send({pets: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should be allowed to get pet by id', function (done) {
            request(baseUrl)
                .get('/pets/' + petId)
                .expect(200)
                .end(done);
        });
        it('should be allowed to put pet by id', function (done) {
            request(baseUrl)
                .put('/pets/' + petId)
                .send({pets: [
                    {name: 'Joseph'}
                ]})
                .expect(200)
                .end(done);
        });
        it('should be allowed to patch pet by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/pets/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/pets/' + petId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for pet', function () {
            throw new Error('Not implemented yet');
        });
    });

    describe('being authed as Moderator', function () {
        beforeEach(function () {
            authorizationStrategy = function (request, permission, rolesAllowed) {
                if (rolesAllowed.length === 0 || -1 < rolesAllowed.indexOf(('Moderator'))) {
                    return Promise.resolve();
                } else {
                    return Promise.reject();
                }
            }
        });
        it('should NOT be allowed to get people', function (done) {
            request(baseUrl)
                .get('/people')
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to post person', function (done) {
            request(baseUrl)
                .post('/people')
                .send({people: [
                    {name: 'Steve'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to get person by id', function (done) {
            request(baseUrl)
                .get('/people/' + personId)
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to put person by id', function (done) {
            request(baseUrl)
                .put('/people/' + personId)
                .send({people: [
                    {name: 'Joseph'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to patch person by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/people/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/people/' + personId)
                .send(patch)
                .expect(403)
                .end(done);
        });
        it.skip('should NOT be allowed to getChangeEventsStreaming for person', function () {
            throw new Error('Not implemented yet');
        });


        it('should NOT be allowed to get users', function (done) {
            request(baseUrl)
                .get('/users')
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to post user', function (done) {
            request(baseUrl)
                .post('/users')
                .send({users: [
                    {name: 'Steve'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should be allowed to get user by id', function (done) {
            request(baseUrl)
                .get('/users/' + userId)
                .expect(200)
                .end(done);
        });
        it('should NOT be allowed to put user by id', function (done) {
            request(baseUrl)
                .put('/users/' + userId)
                .send({users: [
                    {name: 'Joseph'}
                ]})
                .expect(403)
                .end(done);
        });
        it('should NOT be allowed to patch user by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/users/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/users/' + userId)
                .send(patch)
                .expect(403)
                .end(done);
        });
        it.skip('should NOT be allowed to getChangeEventsStreaming for user', function () {
            throw new Error('Not implemented yet');
        });


        it('should be allowed to get pets', function (done) {
            request(baseUrl)
                .get('/pets')
                .expect(200)
                .end(done);
        });
        it('should be allowed to post pet', function (done) {
            request(baseUrl)
                .post('/pets')
                .send({pets: [
                    {name: 'Steve'}
                ]})
                .expect(201)
                .end(done);
        });
        it('should be allowed to get pet by id', function (done) {
            request(baseUrl)
                .get('/pets/' + petId)
                .expect(200)
                .end(done);
        });
        it('should be allowed to put pet by id', function (done) {
            request(baseUrl)
                .put('/pets/' + petId)
                .send({pets: [
                    {name: 'Joseph'}
                ]})
                .expect(200)
                .end(done);
        });
        it('should be allowed to patch pet by id', function (done) {
            var patch = [
                {
                    op: 'replace',
                    path: '/pets/0/name',
                    value: 'Josephine'
                }
            ];
            request(baseUrl)
                .patch('/pets/' + petId)
                .send(patch)
                .expect(200)
                .end(done);
        });
        it.skip('should be allowed to getChangeEventsStreaming for pet', function () {
            throw new Error('Not implemented yet');
        });
    });
});
