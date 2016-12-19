'use strict';
var sinon = require('sinon');
var should = require('should');
var helpers = require('../../lib/route-helpers');

module.exports = function(){

  describe('route-helpers', function(){

    describe('buildPatchOperations', function(){

    });
    describe('squash', function(){
      it('should replace target object keys with source values overwriting targets values with $set type', function(){
        helpers.squash('$set', {a: 1, c: 2}, {a: 3, b: 4}).should.eql({a: 3, b: 4, c: 2});
      });
      it('should replace target object value if it is not set yet for $pushAll', function(){
        helpers.squash('$pushAll', {}, {a: [1]}).should.eql({a: [1]});
      });
      it('should extend target object value if it is set already for $pushAll', function(){
        helpers.squash('$pushAll', {a: [1]}, {a: [2]}).should.eql({a: [1,2]});
      });
    });
    describe('needsPositionalUpdate', function(){
      var model;
      beforeEach(function(){
        model = {
          schema: {
            tree: {
              embedded: [{}],
              plain: {},
              nested: {path: {}},
              link: {}
            }
          }
        };
      });
      it('should return true if update targets embedded schema', function(){
        helpers.needsPositionalUpdate(['embedded', 'any', 'other'], model).should.equal(true);
      });
      it('should return false if update targets resource reference', function(){
        helpers.needsPositionalUpdate(['link'], model).should.equal(false);
      });
      it('should return false if update targets regular path', function(){
        helpers.needsPositionalUpdate(['plain'], model).should.equal(false);
        helpers.needsPositionalUpdate(['nested', 'path'], model).should.equal(false);
      });
    });
    describe('processReplaceOp', function(){
      var model;
      beforeEach(function(){
        model = {
          schema: {
            tree: {
              embedded: [{}]
            }
          }
        }
      });
      it('should return correct $set update', function(){
        helpers.processReplaceOp({
          op: 'replace',
          path: '/resource-name/0/field',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$set',
          update: {
            field: 'x'
          }
        }]);
      });
      it('should correctly handle /links in the update path', function(){
        helpers.processReplaceOp({
          op: 'replace',
          path: '/resource-name/0/links/field',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$set',
          update: {
            field: 'x'
          }
        }]);
      });
      it('should correctly handle updates to deep paths', function(){
        helpers.processReplaceOp({
          op: 'replace',
          path: '/resource-name/0/nested/path',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$set',
          update: {
            'nested.path': 'x'
          }
        }]);
      });
      it('should correctly identify update on embedded schema and apply positional update', function(){
        helpers.processReplaceOp({
          op: 'replace',
          path: '/resource-name/0/embedded/sub-doc-id/path',
          value: 'x'
        }, model).should.eql([{
          match: {'embedded._id': 'sub-doc-id'},
          separate: true,
          key: '$set',
          update: {
            'embedded.$.path': 'x'
          }
        },{
          "key": "$set",
          "match": {
            "_internal.deleted.embedded._id": "sub-doc-id"
          },
          "separate": true,
          "update": {
            "_internal.deleted.embedded.$.path": "x"
          }
        }]);
      });
    });
    describe('processAddOp', function(){
      var model;
      beforeEach(function(){
        model = {
          schema: {
            tree: {
              embedded: [{}]
            }
          }
        };
      });
      it('should correctly handle updates with trailing -', function(){
        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/array/-',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$pushAll',
          update: {
            array: ['x']
          }
        }]);
      });
      it('should correctly handle updates without trailing -',function(){
        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/array',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$pushAll',
          update: {
            array: ['x']
          }
        }]);
      });
      it('should correctly handler updates to links', function(){
        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/links/field',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$pushAll',
          update: {
            field: ['x']
          }
        }]);
      });
      it('should correctly process updates targeted at embedded schemas and apply positional update', function(){
        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/embedded/sub-doc-id/field/-',
          value: 'x'
        }, model).should.eql([{
          match: {'embedded._id': 'sub-doc-id'},
          separate: true,
          key: '$pushAll',
          update: {
            'embedded.$.field': ['x']
          }
        }]);

        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/embedded/-',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$pushAll',
          update: {
            embedded: ['x']
          }
        }]);

        helpers.processAddOp({
          op: 'add',
          path: '/resource-name/0/embedded',
          value: 'x'
        }, model).should.eql([{
          match: {},
          separate: false,
          key: '$pushAll',
          update: {
            embedded: ['x']
          }
        }]);
      });
    });
  });
};