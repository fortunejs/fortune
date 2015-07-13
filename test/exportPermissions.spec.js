var Joi = require('joi');
var expect = require('chai').expect;

var harvester = require('../lib/harvester');
var config = require('./config.js');

describe('Export permissions', function () {

    var harvesterInstance;

    before(function () {
        harvesterInstance = harvester(config.harvester.options);
        var resourceSchema = {name: Joi.string()};
        harvesterInstance.resource('person', resourceSchema).readOnly();
        harvesterInstance.resource('pet', resourceSchema);
        harvesterInstance.resource('user', resourceSchema).immutable();
    });

    it('should export 14 permissions, excluding disallowed ones', function () {
        var expectedPermissions = [
            'person.get', 'person.getById', 'person.getChangeEventsStreaming',
            'pet.get', 'pet.post', 'pet.getById', 'pet.putById', 'pet.deleteById', 'pet.patchById', 'pet.getChangeEventsStreaming',
            'user.get', 'user.post', 'user.getById', 'user.getChangeEventsStreaming'
        ];
        var exportedPermissions = harvesterInstance.exportPermissions();
        expect(exportedPermissions).to.eql(expectedPermissions);
    });

});
